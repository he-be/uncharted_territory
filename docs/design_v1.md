# System Design Document (Phase 1)

## 1. アーキテクチャ概要

本プロジェクトは **TypeScript** と **Phaser 3** を使用し、データ駆動型の **ECS (Entity Component System)** パターンを採用します。
経済シミュレーション等の重い処理は将来的にWeb Workerへ移行可能な設計にしますが、Phase 1ではメインスレッドでの実装を優先し、シンプルさを保ちます。

### 1.1 ディレクトリ構造案
```
src/
  ├── core/           # ゲームループ、基本クラス
  ├── ecs/            # Component定義、System定義
  │   ├── components/
  │   └── systems/
  ├── scenes/         # Phaser Scene (Main, Battle, UI)
  ├── data/           # マスタデータ (Items, Ships, EconomyRules)
  └── ui/             # UIコンポーネント (HTML/DOM overlay or Phaser Objects)
```

---

## 2. データモデル & ECS設計

### 2.1 主要コンポーネント (Components)
エンティティの特性を定義するデータのみのクラス/インターフェース。

*   **Transform:** `x, y, rotation` (グローバル座標)
*   **Velocity:** `vx, vy` (物理移動用)
*   **Cargo:** `items: { [itemId: string]: number }`, `capacity: number`
*   **Wallet:** `credits: number`
*   **AiBehavior:** `state: 'IDLE' | 'TRADING' | 'COMBAT'`, `targetSectorId: string`
*   **CombatStats:** `hp`, `maxHp`, `shields`, `energy`
*   **SectorInfo:** (ステーション/惑星用) `sectorId`, `productionRate`

### 2.2 主要システム (Systems)
ロジックを担当。毎フレーム、対象のComponentを持つEntityを処理する。

*   **MovementSystem:** 速度と慣性に基づいて位置を更新。
*   **EconomySystem (Tick based):**
    *   **Production:** ステーションでの物資生産と消費。
    *   **InventoryConsumption:** 全EntityのCargo内の物資を時間経過で消費する（自然減少）。
*   **AiSystem:**
    *   NPCの意思決定（「あそこで高く売れるから移動しよう」）。
    *   パスファインディング（ゲート移動）。
*   **CombatSystem:**
    *   戦闘状態の管理、ダメージ計算、破壊処理。

---

## 3. ゲームループ詳細

### 3.1 経済シミュレーションループ (The "Alive" Check)
毎フレームではなく、`EconomyTick` (例: 1秒に1回) で更新する。

1.  **InventoryConsumption:** 全在庫の自然減少。0になったら消滅。
2.  **Production:** ステーションが資源を消費し、産品を生成。
3.  **Price Update:** 各ステーションの在庫量に基づいて価格を変動させる（Dynamic Pricing）。

### 3.2 戦闘ループ (FTL Style)
メインの航行とは異なるモード（またはオーバーレイ）として実装。

*   **State:**
    *   `Charging`: 武器チャージ中。
    *   `Firing`: 攻撃実行。
    *   `Cooldown`: 待機時間。
*   **Energy Management:**
    *   プレイヤーは限られた「リアクター出力」を各システム（Shield, Weapon, Engine）に配分する単純な整数管理。

---

## 4. クラス設計 (Core)

### `GameManager` (Singleton)
*   ゲーム全体の状態管理（Paused, Running）。
*   セーブ/ロードの統括。
*   各Systemの初期化と更新呼び出し。

### `Universe`
*   セクターグラフの保持。
*   全Entityの管理（ECSのWorld相当）。

### `Sector`
*   ローカル空間の管理。
*   プレイヤーが現在いるSectorのみ詳細描画し、他は抽象シミュレーション（座標計算のみ or グラフ上の移動のみ）とする "LOD" の基盤。
    *   *Phase 1では全宇宙をメモリに乗せるが、描画コストのみ最適化する方針。*

---

## 5. UI/UX 実装方針

### Phaser vs DOM
複雑なメニューやテキスト量の多い画面（取引画面、インベントリ）は、PhaserのCanvas内描画よりも **HTML/CSS Overlay** の方が開発効率とアクセシビリティが良い。

*   **Map/Combat:** Phaser (Canvas)
*   **Menu/Dialogue/Trade:** HTML Overlay (Absolute positioning on top of Canvas)

---

## 6. フェーズ別実装計画 (Phase 1)

1.  **Step 1:** マップ表示、自船の移動、静的なステーション配置。
2.  **Step 2:** NPC船のスポーン、ランダム移動、基本的な「移動→売買」ロジック。
3.  **Step 3:** 戦闘UIの実装（モック）、敵船との接触判定、ステータス増減の実装。
4.  **Step 4:** ゲーム全体のシーケンス統合（タイトル→ゲーム→ゲームオーバー）。
