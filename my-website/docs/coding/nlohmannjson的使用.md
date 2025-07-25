# nlohmann::json的使用

###  JSON 读取（反序列化）
在 `loadConfig` 方法中：
```cpp
std::ifstream file(config_file);
nlohmann::json j;
file >> j;  // 从文件流中直接读取 JSON
fromJson(j); // 解析 JSON 到配置对象
```

在 `fromJson` 方法中的主要用法：
1. 检查键是否存在：
```cpp
if (j.contains("llm")) { ... }
```

2. 获取值时使用 value 方法带默认值：
```cpp
// 格式：value("键名", 默认值)
app_config_.llm.provider = llm_json.value("provider", "openai");
app_config_.llm.temperature = llm_json.value("temperature", 0.7);
app_config_.llm.max_tokens = llm_json.value("max_tokens", 1000);
```

### JSON 写入（序列化）
在 `saveConfig` 方法中：
```cpp
nlohmann::json j = toJson();
file << j.dump(4);  // dump(4) 表示格式化输出，缩进为4个空格
```

在 `toJson` 方法中的主要用法：
1. 构建嵌套的 JSON 结构：
```cpp
j["llm"]["provider"] = app_config_.llm.provider;
j["llm"]["api_endpoint"] = app_config_.llm.api_endpoint;
j["llm"]["headers"] = app_config_.llm.headers;
```

2. 直接赋值基本类型：
```cpp
j["database_path"] = app_config_.database_path;
j["log_level"] = app_config_.log_level;
j["enable_voice"] = app_config_.enable_voice;
```

### 错误处理
JSON 操作都包含在 try-catch 块中，以处理可能的解析错误：
```cpp
try {
    // JSON 操作
} catch (const std::exception& e) {
    LOG_ERROR("Error loading/saving config: " + std::string(e.what()));
    return false;
}
```

### JSON 结构示例
配置文件的 JSON 结构大致如下：
```json
{
    "llm": {
        "provider": "openai",
        "api_endpoint": "https://api.openai.com/v1/chat/completions",
        "api_key": "",
        "model_name": "gpt-3.5-turbo",
        "temperature": 0.7,
        "max_tokens": 1000,
        "headers": {
            "Content-Type": "application/json"
        }
    },
    "prompt": {
        "system_prompt": "...",
        "user_prompt_template": "...",
        "context_template": "Previous conversation:\n{history}",
        "max_history_messages": 10
    },
    "database_path": "conversations.db",
    "log_level": "INFO",
    "enable_voice": true,
    "auto_save_conversations": true
}
```

### 小结
1. 使用 `value()` 方法提供默认值，确保配置加载的健壮性
2. 使用 `contains()` 检查可选字段的存在性
3. JSON 操作进行异常处理
4. 使用格式化输出（`dump(4)`）提高配置文件的可读性

