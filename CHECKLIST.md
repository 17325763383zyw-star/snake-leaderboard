# 最短上线清单

## 第一步：Supabase
- 打开 Supabase 并创建项目
- 打开 SQL Editor
- 粘贴并执行 `supabase-ready.sql`
- 在 `Project Settings -> API` 复制：
  - `Project URL`
  - `anon public key`

## 第二步：Git 仓库
- 把 `snake-leaderboard` 整个目录上传到你的 Git 仓库
- 确认这些文件都在：
  - `index.html`
  - `style.css`
  - `game.js`
  - `supabase.js`
  - `config.js`
  - `supabase-ready.sql`
  - `supabase.sql`
  - `api/config.js`
  - `vercel.json`
  - `.gitignore`

## 第三步：Vercel
- 新建 Project
- 选择你的 Git 仓库
- Root Directory 设为 `snake-leaderboard`
- 配置环境变量：
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- 点击 Deploy

## 第四步：验收
- 打开网站
- 先看排行榜能否正常加载
- 玩一局并输入 ID 提交
- 刷新页面看数据是否保留
- 用另一个浏览器打开看是否共享排行榜
