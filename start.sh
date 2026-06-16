#!/bin/bash
cd /root/feishu-bot
source /root/.env.bot
export DEEPSEEK_API_KEY
setsid node bot.js </dev/null > /tmp/bot.log 2>&1 &
echo $!
