# MQTT异步编程

## 环境

* `Eclipse Paho C `客户端库

  github地址：`https://github.com/eclipse-paho/paho.mqtt.c.git`

* WalnutPi 2代

  * 版本信息：`Linux WalnutPi 5.15.147 #19 SMP PREEMPT Fri Feb 28 17:17:37 CST 2025 aarch64 GNU/Linux`
  * toolchain：`toolchain=gcc-aarch64-linux-gnu`

## code

* 使用`paho mqtt c`异步接口
  * 建立连接的操作会在另外一个线程
* 当连接建立成功之后，采集数据子线程（生产者）感知到后，采集封装数据，并通知发送数据子线程（消费者）；
* 发送数据子线程（消费者）接收到通知后，获取数据，调用`paho mqtt c`发送数据接口发送

```cpp
#include <iostream>
#include <cstring>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <string>
#include <sstream>
#include <fstream>
#include <atomic>
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <unistd.h>
#include "MQTTAsync.h"

#define ADDRESS     "tcp://172.20.10.7:1883"
#define CLIENTID    "ExampleClientPub"
#define TOPIC       "MQTT Examples"
#define PAYLOAD     "Hello World!"
#define QOS         2
#define TIMEOUT     10000L

#define LWT_TOPIC   "MQTT LWT"
#define LWT_PAYLOAD "Client disconnected unexpectedly"

volatile MQTTAsync_token deliveredtoken;
std::mutex bufmx;
std::mutex cv_m;
std::condition_variable cv;
std::string buff;

bool data_available = false;
std::atomic<bool> running{true};

bool mqtt_connected = false;

void delivered(void *context, MQTTAsync_token dt) {
    std::cout << "Message with token value " << dt << " delivery confirmed." << std::endl;
    deliveredtoken = dt;
}

void connlost(void *context, char *cause) {
    std::cout << "\nConnection lost" << std::endl;
    std::cout << "     cause: " << cause << std::endl;
}

void onSend(void* context, MQTTAsync_successData* response) {
    std::cout << "onSend tid: " << gettid() << std::endl;
    std::cout << "Message with token " << response->token << " delivered." << std::endl;
}

void onSendFailure(void* context, MQTTAsync_failureData* response) {
    std::cout << "Failed to deliver message with token " << response->token << ", rc " << response->code << std::endl;
}

void onConnectFailure(void* context, MQTTAsync_failureData* response) {
    std::cout << "Connect failed, rc " << response->code << std::endl;
    exit(EXIT_FAILURE);
}

void onConnect(void* context, MQTTAsync_successData* response) {
    std::cout << "Connected successfully, tid: " << gettid() << std::endl;
    mqtt_connected = true;
    // MQTTAsync client = (MQTTAsync)context;
    // MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    // MQTTAsync_message pubmsg = MQTTAsync_message_initializer;
    // int rc;

    // opts.onSuccess = onSend;
    // opts.onFailure = onSendFailure;
    // opts.context = client;

    // // while (running) {
    //     std::unique_lock<std::mutex> lg(bufmx);
    //     cv.wait(lg, [&] { 
    //         return data_available || !running; 
    //     });
    //     std::string buf = buff;
    //     lg.unlock();
    //     pubmsg.payload = (void*)buf.c_str();
    //     pubmsg.payloadlen = buf.length();
    //     pubmsg.qos = QOS;
    //     pubmsg.retained = 0;
    //     if ((rc = MQTTAsync_sendMessage(client, TOPIC, &pubmsg, &opts)) != MQTTASYNC_SUCCESS) {
    //         std::cout << "Failed to start sendMessage, return code " << rc << std::endl;
    //         exit(EXIT_FAILURE);
    //     }
    //     std::this_thread::sleep_for(std::chrono::seconds(2));
    //     std::cout << "-------send messages succ----------" << std::endl;
    // }
    // pubmsg.payload = (void*)PAYLOAD;
    // pubmsg.payloadlen = strlen(PAYLOAD);
    // pubmsg.qos = QOS;
    // pubmsg.retained = 0;
    // if ((rc = MQTTAsync_sendMessage(client, TOPIC, &pubmsg, &opts)) != MQTTASYNC_SUCCESS) {
    //     std::cout << "Failed to start sendMessage, return code " << rc << std::endl;
    //     exit(EXIT_FAILURE);
    // }
}

// 获取传感器类型（如CPU/GPU）
std::string get_sensor_type(int zone_id) {
    std::string type_path = "/sys/class/thermal/thermal_zone" + std::to_string(zone_id) + "/type";
    std::ifstream type_file(type_path);
    std::string type;
    std::getline(type_file, type);
    return type.empty() ? "Unknown" : type;
}

int main(int argc, char* argv[]) {
    std::thread t([](){
        while (running) {
            std::stringstream ss;
            // 遍历所有thermal_zone（0-5）
            for (int zone_id = 0; zone_id <= 5; ++zone_id) {
                std::string path = "/sys/class/thermal/thermal_zone" + std::to_string(zone_id) + "/temp";
                std::ifstream file(path);
                if (!file) continue;
                
                std::string temp;
                std::getline(file, temp);
                
                // 校验温度值有效性
                if (temp.empty() || !std::all_of(temp.begin(), temp.end(), ::isdigit)) {
                    ss << "Zone " << zone_id << " (" << get_sensor_type(zone_id) << "): Invalid data\n";
                    continue;
                }
                
                // 格式化温度值（原始值为千分位摄氏度）
                float temp_c = std::stof(temp) / 1000.0f;
                ss << "Zone " << zone_id << " (" << get_sensor_type(zone_id) << "): " 
                   << temp_c << "°C\n";
                std::cout << ss.str() << std::endl;
            }

            {
                std::lock_guard lg(bufmx);
                buff = ss.str();
                data_available = true;
            }
            cv.notify_one();
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }
    });

    MQTTAsync client;
    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    int rc;

    std::cout << "main tid: " << gettid() << std::endl;

    MQTTAsync_create(&client, ADDRESS, CLIENTID, MQTTCLIENT_PERSISTENCE_NONE, NULL);
    MQTTAsync_setCallbacks(client, NULL, connlost, NULL, delivered);

    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 1;
    conn_opts.username = "admin";
    conn_opts.password = "admin";
    conn_opts.onSuccess = onConnect;
    conn_opts.onFailure = onConnectFailure;
    conn_opts.context = client;

    //遗嘱消息初始化
    MQTTAsync_willOptions will_opts = MQTTAsync_willOptions_initializer;
    will_opts.topicName = LWT_TOPIC;
    will_opts.message = LWT_PAYLOAD;
    will_opts.qos = QOS;
    will_opts.retained = 0;
    conn_opts.will = &will_opts;

    if ((rc = MQTTAsync_connect(client, &conn_opts)) != MQTTASYNC_SUCCESS) {
        std::cout << "Failed to start connect, return code " << rc << std::endl;
        exit(EXIT_FAILURE);
    }
    std::thread t2([&client](){
        while (running) {
            if (mqtt_connected) {
                MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
                MQTTAsync_message pubmsg = MQTTAsync_message_initializer;
                int rc;
            
                opts.onSuccess = onSend;
                opts.onFailure = onSendFailure;
                opts.context = client;
            
                std::unique_lock<std::mutex> lg(bufmx);
                cv.wait(lg, [&] { 
                    return data_available || !running; 
                });
                std::string buf = buff;
                buff = "";
                lg.unlock();
                
                pubmsg.payload = (void*)buf.c_str();
                pubmsg.payloadlen = buf.length();
                pubmsg.qos = QOS;
                pubmsg.retained = 0;
                if ((rc = MQTTAsync_sendMessage(client, TOPIC, &pubmsg, &opts)) != MQTTASYNC_SUCCESS) {
                    std::cout << "Failed to start sendMessage, return code " << rc << std::endl;
                    exit(EXIT_FAILURE);
                }
                std::cout << "-------send messages succ----------" << std::endl;
            }
            std::this_thread::sleep_for(std::chrono::seconds(2));
        }
    });

    // Keep the client running to ensure message delivery
    t.join();
    t2.join();

    MQTTAsync_disconnect(client, NULL);
    MQTTAsync_destroy(&client);
    return rc;
}
```

订阅端代码同样使用异步接口：

```cpp
#include <iostream>
#include <cstring>
#include <cstdlib>
#include <unistd.h>
#include <string>
#include "MQTTAsync.h"

#define ADDRESS     "tcp://172.20.10.7:1883"
#define CLIENTID    "ExampleClientSub"
#define TOPIC       "MQTT Examples"
#define QOS         2

#define LWT_TOPIC   "MQTT LWT"

void connlost(void *context, char *cause) {
    std::cout << "\nConnection lost" << std::endl;
    std::cout << "     cause: " << cause << std::endl;
}

int msgarrvd(void *context, char *topicName, int topicLen, MQTTAsync_message *message) {
    std::cout << "Message arrived" << std::endl;
    std::cout << "     topic: " << topicName << std::endl;
    std::cout << "   message: " << std::string((char*)message->payload, message->payloadlen) << std::endl;
    MQTTAsync_freeMessage(&message);
    MQTTAsync_free(topicName);
    return 1;
}

void onConnectFailure(void* context, MQTTAsync_failureData* response) {
    std::cout << "Connect failed, rc " << response->code << std::endl;
    exit(EXIT_FAILURE);
}

void onSuccess(void* context, MQTTAsync_successData* response) {
    std::cout << "Subscribe succeeded" << std::endl;
}

void onFail(void* context, MQTTAsync_failureData* response) {
    std::cout << "Subscribe failed, rc " << response->code << std::endl;
    exit(EXIT_FAILURE);
}

void onConnect(void* context, MQTTAsync_successData* response) {
    std::cout << "Connected successfully" << std::endl;
    MQTTAsync client = (MQTTAsync)context;
    MQTTAsync_responseOptions opts = MQTTAsync_responseOptions_initializer;
    int rc;

    opts.onSuccess = onSuccess;
    opts.onFailure = onFail;
    opts.context = client;

    if ((rc = MQTTAsync_subscribe(client, TOPIC, QOS, &opts)) != MQTTASYNC_SUCCESS) {
        std::cout << "Failed to start subscribe, return code " << rc << std::endl;
        exit(EXIT_FAILURE);
    }

    if ((rc = MQTTAsync_subscribe(client, LWT_TOPIC, QOS, &opts)) != MQTTASYNC_SUCCESS) {
        std::cout << "Failed to start subscribe, return code " << rc << std::endl;
        exit(EXIT_FAILURE);
    }
}

int main(int argc, char* argv[]) {
    MQTTAsync client;
    MQTTAsync_connectOptions conn_opts = MQTTAsync_connectOptions_initializer;
    int rc;

    MQTTAsync_create(&client, ADDRESS, CLIENTID, MQTTCLIENT_PERSISTENCE_NONE, NULL);
    MQTTAsync_setCallbacks(client, NULL, connlost, msgarrvd, NULL);

    conn_opts.keepAliveInterval = 20;
    conn_opts.cleansession = 0;
    conn_opts.username = "admin";
    conn_opts.password = "admin";
    conn_opts.onSuccess = onConnect;
    conn_opts.onFailure = onConnectFailure;
    conn_opts.context = client;

    if ((rc = MQTTAsync_connect(client, &conn_opts)) != MQTTASYNC_SUCCESS) {
        std::cout << "Failed to start connect, return code " << rc << std::endl;
        exit(EXIT_FAILURE);
    }

    // Keep the client running to receive messages
    while (true) {
        sleep(1);
    }

    MQTTAsync_disconnect(client, NULL);
    MQTTAsync_destroy(&client);
    return rc;
}
```

发布端运行结果如下：

```shell
root@WalnutPi:~/test/test/test_paho# ./pub
main tid: 119061
Zone 0 (cpul_thermal_zone): 62.595°C

Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C

Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C
Zone 2 (gpu_thermal_zone): 61.425°C

Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C
Zone 2 (gpu_thermal_zone): 61.425°C
Zone 3 (npu_thermal_zone): 61.425°C

Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C
Zone 2 (gpu_thermal_zone): 61.425°C
Zone 3 (npu_thermal_zone): 61.425°C
Zone 4 (ddr_thermal_zone): 62.075°C

Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C
Zone 2 (gpu_thermal_zone): 61.425°C
Zone 3 (npu_thermal_zone): 61.425°C
Zone 4 (ddr_thermal_zone): 62.075°C
Zone 5 (axp2202-usb): 53.7°C

Connected successfully, tid: 119064
-------send messages succ----------
Zone 0 (cpul_thermal_zone): 62.075°C

Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C

Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.36°C

Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.36°C
Zone 3 (npu_thermal_zone): 61.36°C

Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.36°C
Zone 3 (npu_thermal_zone): 61.36°C
Zone 4 (ddr_thermal_zone): 62.14°C

Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.36°C
Zone 3 (npu_thermal_zone): 61.36°C
Zone 4 (ddr_thermal_zone): 62.14°C
Zone 5 (axp2202-usb): 53.7°C

onSend tid: 119064
Message with token 1 delivered.
-------send messages succ----------
Zone 0 (cpul_thermal_zone): 62.27°C

Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C

Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C
Zone 2 (gpu_thermal_zone): 61.295°C

Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C
Zone 2 (gpu_thermal_zone): 61.295°C
Zone 3 (npu_thermal_zone): 61.295°C

Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C
Zone 2 (gpu_thermal_zone): 61.295°C
Zone 3 (npu_thermal_zone): 61.295°C
Zone 4 (ddr_thermal_zone): 62.205°C

Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C
Zone 2 (gpu_thermal_zone): 61.295°C
Zone 3 (npu_thermal_zone): 61.295°C
Zone 4 (ddr_thermal_zone): 62.205°C
Zone 5 (axp2202-usb): 53.7°C

onSend tid: 119064
Message with token 2 delivered.
-------send messages succ----------

```

订阅端运行结果如下：

```shell
:~/git_pro/paho-mqtt-c/test/test_two_host_async$ ./sub 
Connected successfully
Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.985°C
Zone 1 (cpub_thermal_zone): 63.18°C
Zone 2 (gpu_thermal_zone): 62.205°C
Zone 3 (npu_thermal_zone): 62.205°C
Zone 4 (ddr_thermal_zone): 62.335°C
Zone 5 (axp2202-usb): 54.3°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.79°C
Zone 1 (cpub_thermal_zone): 62.92°C
Zone 2 (gpu_thermal_zone): 62.53°C
Zone 3 (npu_thermal_zone): 62.53°C
Zone 4 (ddr_thermal_zone): 62.855°C
Zone 5 (axp2202-usb): 54.3°C

Message arrived
     topic: MQTT LWT
   message: Client disconnected unexpectedly
Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.595°C
Zone 1 (cpub_thermal_zone): 62.27°C
Zone 2 (gpu_thermal_zone): 61.425°C
Zone 3 (npu_thermal_zone): 61.425°C
Zone 4 (ddr_thermal_zone): 62.075°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.075°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.36°C
Zone 3 (npu_thermal_zone): 61.36°C
Zone 4 (ddr_thermal_zone): 62.14°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.01°C
Zone 2 (gpu_thermal_zone): 61.295°C
Zone 3 (npu_thermal_zone): 61.295°C
Zone 4 (ddr_thermal_zone): 62.205°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.035°C
Zone 3 (npu_thermal_zone): 61.035°C
Zone 4 (ddr_thermal_zone): 61.945°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 62.27°C
Zone 1 (cpub_thermal_zone): 62.4°C
Zone 2 (gpu_thermal_zone): 61.425°C
Zone 3 (npu_thermal_zone): 61.425°C
Zone 4 (ddr_thermal_zone): 61.88°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 61.945°C
Zone 1 (cpub_thermal_zone): 62.205°C
Zone 2 (gpu_thermal_zone): 61.165°C
Zone 3 (npu_thermal_zone): 61.165°C
Zone 4 (ddr_thermal_zone): 61.75°C
Zone 5 (axp2202-usb): 53.7°C

Message arrived
     topic: MQTT Examples
   message: Zone 0 (cpul_thermal_zone): 61.815°C
Zone 1 (cpub_thermal_zone): 61.88°C
Zone 2 (gpu_thermal_zone): 61.1°C
Zone 3 (npu_thermal_zone): 61.1°C
Zone 4 (ddr_thermal_zone): 61.945°C
Zone 5 (axp2202-usb): 53.7°C
...
```

## 数据包情况

在WalnutPi 2端抓取数据包如下：

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250312154444.png)

在订阅端主机抓取数据包如下：

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250312161528.png)

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20250312161609.png)

## 流程总结

发布者和订阅者的流程如下：（左边为发布者，右边为订阅者）

![](https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/mqtt.drawio.png)

注意，以上示例为**Qos 2**的情况。