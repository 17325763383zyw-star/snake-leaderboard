# Snake Leaderboard

这是一个可部署到 Vercel 的网页版贪吃蛇站点，使用 Supabase 保存排行榜。

## 文件说明
- `index.html`：页面入口
- `style.css`：补充样式
- `game.js`：贪吃蛇玩法与提交逻辑
- `config.js`：填写 Supabase 配置
- `supabase.js`：排行榜读取与提交
- `supabase.sql`：Supabase 初始化 SQL
- `vercel.json`：Vercel 配置

## 本地准备
1. 在 Supabase 创建项目
2. 执行 `supabase.sql`
3. 把 `config.js` 改成你的配置：
   - `window.SNAKE_SUPABASE_URL`
   - `window.SNAKE_SUPABASE_ANON_KEY`

## 部署
1. 把整个 `snake-leaderboard` 目录上传到 Git 仓库
2. 在 Vercel 导入仓库
3. 直接部署静态站点

## 注意
- 前端只能使用 Supabase 的匿名公钥，不能填 service role key
- 当前版本是最小可用方案，具备匿名提交的基础刷榜风险
