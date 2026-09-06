# FitMe

专为年轻男性设计的一站式 AI 穿搭平台：根据身材、肤色、风格偏好和场景生成穿搭方案，并支持风格报告、商品推荐、穿搭灵感与试穿预览。

## 技术栈

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

## 本地开发

```bash
npm install
npm run dev
```

如需连接后端，请在 `.env` 中设置：

```bash
VITE_API_BASE_URL=你的后端地址
```

可参考 `.env.example`。

## 构建

```bash
npm run build
```

## 部署

仓库已包含 GitHub Pages Actions 配置：

```text
.github/workflows/deploy.yml
```

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。
