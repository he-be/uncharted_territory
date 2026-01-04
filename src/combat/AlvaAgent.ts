import { DialogueOverlay } from '../ui/DialogueOverlay';

interface GameState {
  playerHealth: number;
  ammo: number;
  killStreak: number;
  deathStreak: number;
  battleDuration: number;
  enemiesNearby: number;
  bossActive: boolean;
  momentum: number; // -100 to 100
  // Tactical Metrics
  nearestEnemyDist: number;
  closingSpeed: number; // Positive = closing
  timeToContact: number; // Seconds, -1 if not closing
}

interface TriggerEvent {
  type: string;
  value: string | number;
  description: string;
}

export class AlvaAgent {
  private overlay: DialogueOverlay;
  private state: GameState;
  private history: string[] = []; // Recent event history
  private lastCommentaryTime: number = 0;
  private apiKey: string;
  private pendingRequest: boolean = false;

  // Triggers/Cooldowns
  private categoryCooldowns: Map<string, number> = new Map();
  private readonly MIN_INTERVAL = 3000; // 3s

  constructor(overlay: DialogueOverlay) {
    this.overlay = overlay;
    this.apiKey = import.meta.env.OPENROUTER_API_KEY || ''; // Exposed via vite.config.ts

    this.state = {
      playerHealth: 100,
      ammo: 100,
      killStreak: 0,
      deathStreak: 0,
      battleDuration: 0,
      enemiesNearby: 0,
      bossActive: false,
      momentum: 0,
      nearestEnemyDist: 99999,
      closingSpeed: 0,
      timeToContact: -1,
    };

    if (!this.apiKey) {
      this.overlay.addMessage('SYSTEM: OPENROUTER_API_KEY not found.');
    } else {
      this.overlay.addMessage('SYSTEM: A.L.V.A. Online.');
    }
  }

  public updateState(partialState: Partial<GameState>) {
    this.state = { ...this.state, ...partialState };
  }

  public reportEvent(event: TriggerEvent) {
    const now = Date.now();
    this.history.push(event.description);
    if (this.history.length > 10) this.history.shift();

    // Check cooldowns
    if (this.pendingRequest) return;
    if (now - this.lastCommentaryTime < this.MIN_INTERVAL) return;

    const categoryLastTime = this.categoryCooldowns.get(event.type) || 0;
    if (now - categoryLastTime < 10000) return; // 10s category cooldown

    // Trigger commentary
    this.generateCommentary(event);
  }

  private async generateCommentary(trigger: TriggerEvent) {
    if (!this.apiKey) return;

    this.pendingRequest = true;

    // Construct Prompt
    const prompt = this.constructPrompt(trigger);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5173', // Optional
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter Error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        this.processResponse(content, trigger.type);
      }
    } catch (e) {
      console.error('ALVA Generation Failed:', e);
      this.overlay.addMessage(`SYSTEM: Connection Error (${e})`);
    } finally {
      this.pendingRequest = false;
    }
  }

  private constructPrompt(trigger: TriggerEvent): string {
    // Determine Phase
    let phase = 'UNKNOWN';
    if (this.state.battleDuration < 10) {
      phase = 'DEPLOYMENT (Start)';
    } else if (this.state.nearestEnemyDist > 2000) {
      phase = 'APPROACH (Moving to frontline)';
    } else if (this.state.nearestEnemyDist > 800) {
      phase = 'SKIRMISH (Long range)';
    } else {
      phase = 'MELEE (Close combat)';
    }

    const contextJson = JSON.stringify(
      {
        trigger_type: trigger.type,
        trigger_value: trigger.value,
        phase: phase,
        tactical: {
          distance_to_enemy: Math.round(this.state.nearestEnemyDist),
          closing_speed: Math.round(this.state.closingSpeed),
          time_to_contact:
            this.state.timeToContact > 0 ? `${Math.round(this.state.timeToContact)}s` : 'N/A',
        },
        player_state: {
          health: this.state.playerHealth,
          ammo: this.state.ammo,
        },
        battle_state: {
          duration: Math.round(this.state.battleDuration),
          enemies_nearby: this.state.enemiesNearby,
          boss: this.state.bossActive,
          momentum: this.state.momentum,
        },
        recent_events: this.history.slice(-5),
      },
      null,
      2
    );

    return `
あなたはA.L.V.A.、SFドローン艦隊戦のAI戦術オペレーターです。
プレイヤー(母艦)とドローン部隊が、敵艦隊に向かって進軍しています。

【世界観・ルール】
- **シールド機能は存在しません**。「シールド」という言葉は絶対に使わないでください。
- 戦闘の流れ: 出撃 → 接敵行軍 → 遠距離戦 → 混戦
- プレイヤーは母艦としてドローンと共に前進します。

【キャラクター設定】
- 冷静で的確な戦術眼を持つ
- 距離や時間を具体的に言及すると「AIらしさ」が出る
  - 例:「接敵まであと20秒」「距離1500、射程外」
- 感情は抑え目だが、戦況が悪化すると焦りを見せる

【制約】
- 全てのセリフは80文字以内
- 5種類のバリエーションを生成
- シールドには言及しない
- 状況(Phase)に合わせた発言をする

【現在の戦況データ】
${contextJson}

【タスク】
上記戦況データに基づき、状況に適した実況セリフを5つ生成せよ。
出力形式:
1. [セリフ]
...
`;
  }

  private processResponse(responseText: string, type: string) {
    // Parse the 5 lines
    const lines = responseText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d+\./.test(line)) // Match "1. Text"
      .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^\[|\]$/g, '')); // Remove number and brackets if any

    if (lines.length > 0) {
      // Pick one randomly or simply the first
      const selected = lines[Math.floor(Math.random() * lines.length)];

      this.overlay.addMessage(`A.L.V.A: ${selected}`);

      // Update timestamps
      const now = Date.now();
      this.lastCommentaryTime = now;
      this.categoryCooldowns.set(type, now);
    }
  }
}
