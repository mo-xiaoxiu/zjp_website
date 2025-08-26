# Vscode LLM翻译器！支持本地ollama+OpenAI

作为一名开发者，你是否经常遇到需要阅读和理解外文技术文档的情况？或者需要将自己的代码注释翻译成英文？今天给大家介绍一款VS Code扩展——**LLM Translate with mo-xiaoxiu**。

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826212934.png)

传统的网页翻译工具需要频繁切换窗口，破坏开发流程。这款VS Code扩展或许能帮上你：

• ✅ 直接在编辑器中划词翻译
• ✅ 支持本地Ollama模型
• ✅ 兼容OpenAI接口，灵活选择服务商
• ✅ 保留代码格式
• ✅ 支持流式输出，实时看到翻译结果

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826205845.png)

*选中文本内容，右键选择”翻译为中文“*

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826210114.png)

*如果选择流式输出，则下方提示栏会动态显示翻译过程*

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826205244.png)

*翻译完成，鼠标悬停在选中内容上可看到浮窗内翻译好的内容；支持上下滑动*

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826205423.png)

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826205542.png)

*在浮窗头部，可复制翻译好的内容，也可打开链接将翻译好的内容放到单独文本中*

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826210242.png)

*如果翻译文本过长，在翻译完成后会自动打开新标签页，将翻译内容单独展示，当然也可以回到主标签页查看浮窗翻译*

## 环境要求

满足以下条件即可运行：
• VS Code：版本 ≥ 1.75
• 操作系统：`Windows/macOS/Linux`均可
• 网络要求：
    ◦ 使用`Ollama`：本地或局域网可访问的Ollama服务
    ◦ 使用`OpenAI/或代理商`：可访问对应API的网络与有效API Key

## 安装教程

1. 打开VS Code，进入扩展视图（左侧方块图标）
2. 点击右上角"..." -> 选择`Install from VSIX...`
3. 选择下载的插件文件：`zjp-llm-translate-<version>.vsix`
4. 安装完成后重载VS Code

安装后直接在终端使用，超级方便！

## 简单配置

在VS Code的`settings.json`中添加以下配置：
```json
{
  "llm.provider": "ollama",                 // 或openai
  "llm.endpoint": "http://localhost:11434", // ollama服务地址
  "llm.model": "deepseek-r1:8b",            // 使用的模型

  // OpenAI配置示例
  "llm.openai.baseUrl": "https://api.openai.com",
  "llm.openai.apiKey": "sk-...",
  "llm.openai.model": "gpt-4o-mini",

  // 翻译目标语言，默认中文
  "llm.targetLanguage": "zh"
}
```

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250826210728.png)

*在Vscode用户设置中搜索`llm`也可以找到相关配置*

## 使用方式

• 右键翻译：选中文本 -> 右键菜单 -> "翻译选中文本"
• 命令面板：Ctrl/Cmd+Shift+P 搜索翻译命令
• 快捷键：Ctrl+Alt+T 快速翻译选区

## 特色功能

• 小文本结果直接在悬浮窗显示，支持一键复制
• 大文本结果自动在新文档打开，阅读体验极佳
• 支持流式/非流式输出，可随时取消翻译过程
• 保留最近翻译结果，中英文切换方便

## 两种服务模式

🖥️ **本地Ollama模式**（推荐用于代码翻译）
保护隐私，无需网络：
* 首先安装并启动Ollama服务
```shell
ollama serve
```
* 拉取所需模型（如`deepseek-r1:8b`）
```shell
ollama run deepseek-r1:8b
```

🌐 **OpenAI兼容模式**

支持所有兼容OpenAI接口的服务：
```json
{
  "llm.provider": "openai",
  "llm.openai.baseUrl": "https://api.your-service.com",
  "llm.openai.apiKey": "your-api-key",
  "llm.openai.model": "your-model-name"
}
```

## 常见问题解答

Q：安装后没有翻译结果？
>A：请确认已正确配置模型服务，并且有文本选区

Q：遇到401/403错误？
>A：检查API Key和baseUrl是否正确（**注意baseUrl不带/v1**）

Q：Ollama连接失败？
>A：确认ollama serve正在运行，且端点地址正确

