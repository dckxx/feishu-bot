#!/usr/bin/env node
const { spawn, execSync } = require("child_process");
const readline = require("readline");
const fs = require("fs");
const path = require("path");

const LARK_CLI = "lark-cli";
const SESSIONS_FILE = path.join(__dirname, "sessions.json");

let sessions = {};
try { sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")); } catch {}

function saveSessions() {
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function getLatestSessionId() {
  try {
    const out = execSync("opencode session list --format json 2>/dev/null", {
      encoding: "utf8", timeout: 5000,
    });
    const list = JSON.parse(out);
    const botDir = "/root/feishu-bot";
    const match = list.find(s => s.directory === botDir);
    return match ? match.id : null;
  } catch {
    return null;
  }
}

async function callOpenCode(chatId, message) {
  return new Promise((resolve, reject) => {
    const args = ["run", message, "--dir", "/root/feishu-bot"];
    if (sessions[chatId]) {
      args.push("--continue", "--session", sessions[chatId]);
    }
    const proc = spawn("opencode", args, {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 180000,
      env: { ...process.env, OPENCODE_SKIP_WELCOME: "1" },
    });
    let stdout = "";
    proc.stdout.on("data", d => stdout += d);
    let stderr = "";
    proc.stderr.on("data", d => stderr += d);
    proc.on("close", code => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`exit ${code}: ${stderr.slice(-300)}`));
        return;
      }
      // capture the session that was just used/created
      const sid = getLatestSessionId();
      if (sid) {
        sessions[chatId] = sid;
        saveSessions();
        console.log(`[session] chat=${chatId} sid=${sid}`);
      }
      resolve(stdout.trim().slice(0, 2000) || "（没有返回内容）");
    });
  });
}

async function sendMessage(chatId, text, useMarkdown = false) {
  return new Promise((resolve, reject) => {
    const args = [
      "im", "+messages-send",
      "--as", "bot",
      "--chat-id", chatId,
    ];
    if (useMarkdown) {
      args.push("--markdown", text.slice(0, 2000));
    } else {
      args.push("--text", text.slice(0, 2000));
    }
    const proc = spawn(LARK_CLI, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    proc.stdout.on("data", d => out += d);
    proc.on("close", code => {
      if (code === 0) resolve(out);
      else reject(new Error(`send failed: ${out}`));
    });
  });
}

async function handleEvent(event) {
  if (event.type !== "im.message.receive_v1") return;
  const chatId = event.chat_id;
  const content = event.content;
  const sender = event.sender || {};
  const senderId = sender.sender_id || {};
  const openId = senderId.open_id || "unknown";
  const chatType = event.chat_type || "p2p";
  console.log(`[receive] chat=${chatId} user=${openId} type=${chatType} text=${content}`);

  // Send natural text with sender context so opencode knows who's talking
  const contextualMessage = chatType === "group"
    ? `[${openId}] ${content}`
    : content;

  try {
    await sendMessage(chatId, "⏳ 正在处理...");
    const reply = await callOpenCode(chatId, contextualMessage);
    await sendMessage(chatId, reply, true);
    console.log(`[reply] sent to chat=${chatId}`);
  } catch (err) {
    console.error(`[error] ${err.message}`);
    try {
      await sendMessage(chatId, `❌ ${err.message}`);
    } catch {}
  }
}

const eventProc = spawn(LARK_CLI, [
  "event", "consume", "im.message.receive_v1",
  "--as", "bot",
], { stdio: ["pipe", "pipe", "pipe"] });

console.log("[bot] started, forwarding messages to opencode...");

const rl = readline.createInterface({ input: eventProc.stdout });
rl.on("line", line => {
  try {
    const event = JSON.parse(line);
    handleEvent(event);
  } catch {}
});

eventProc.stderr.on("data", d => process.stderr.write(d));
eventProc.on("exit", code => {
  console.log(`[bot] event consumer exited with code ${code}`);
  process.exit(code);
});

process.on("SIGINT", () => { eventProc.kill(); process.exit(); });
process.on("SIGTERM", () => { eventProc.kill(); process.exit(); });
