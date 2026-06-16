# 飞书机器人接入 OpenCode

通过 lark-cli 将飞书机器人接入 OpenCode，在飞书聊天中直接调用 AI 完成任务。

## 架构

```
飞书消息 → lark-cli event consume → bot.js → opencode run → LLM
                                                          ↓
飞书回复 ← lark-cli im +messages-send ← bot.js ←────────┘
```

## 前置条件

- Node.js v18+
- [lark-cli](https://github.com/larksuite/cli) 已安装并 `lark-cli auth login`
- [opencode](https://opencode.ai) 已安装
- 飞书企业自建应用，具备 `im:message` 和 `event:message` 权限

## 安装

```bash
git clone https://github.com/dckxx/feishu-bot.git
cd feishu-bot
```

创建环境变量：

```bash
cp .env.example .env.bot
# 编辑 .env.bot 填入你的 API Key
```

## 启动

```bash
bash start.sh
```

日志输出到 `/tmp/bot.log`，启动成功可见：

```
[bot] started, forwarding messages to opencode...
[event] ready event_key=im.message.receive_v1
```

## 管理

| 命令 | 用途 |
|------|------|
| `bash start.sh` | 启动机器人 |
| `ps aux \| grep "node bot.js"` | 查看进程 |
| `kill <PID>` | 停止机器人 |
| `tail -f /tmp/bot.log` | 实时查看日志 |
| `opencode session list` | 查看所有 session |
| `opencode session delete <id>` | 删除 session |

## 项目文件

| 文件 | 说明 |
|------|------|
| `bot.js` | 主程序：事件监听、消息路由、OpenCode 调用、会话管理 |
| `start.sh` | 后台启动脚本 |
| `sessions.json` | 会话持久化（自动生成，不提交） |
| `.env.bot` | 环境变量（不提交） |

## 会话管理

- 每个飞书聊天独立维护 opencode session，上下文不串扰
- session 按 `/root/feishu-bot` 目录过滤，避免跨项目干扰
- 支持自动压缩，长对话不会丢失上下文
