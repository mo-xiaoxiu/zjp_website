# NMEAParse
NMEAParse旨在C++应用中解析NMEA原始报文相关业务，方便地使用对象得出解析的定位信息。本项目需要根据指引编译成动态库，在用户的程序中只需要包含头文件并在编译时连接该动态库即可。

## 功能

该项目的核心功能是解析`NMEA`格式的消息。`NMEAParser` 类可以解析输入的 `NMEA` 消息并验证其有效性。它支持常见的 `NMEA` 格式，能够处理消息校验和并提取相关数据。

## 主要组件

* `src/NMEAParser.cpp`和`include/NMEAParser.h`：这是 `NMEA` 消息解析器的实现部分，包含了消息解析的核心逻辑。
* `build.sh`：这是一个自动化编译脚本，自动配置和编译项目，便于开发者快速构建和运行测试。

## 构建和安装

1. 安装依赖项
本项目依赖 `CMake`。如果你没有安装这些工具，按照以下步骤进行安装：

* 安装 `CMake`
Ubuntu：
```
sudo apt-get install cmake
```

2. 构建项目
项目使用 `CMake` 进行构建。按照以下步骤来构建项目：

克隆该项目：
```
git clone https://github.com/yourusername/nmea-parser.git
```
运行自动化构建脚本：
```
cd nmea-parser
./build.sh
```
该脚本会：
* 创建一个 build 目录，生成编译产物。
* `CMake` 构建系统，该NMEA解析器会生成动态库和头文件。
* 如果不指定`MY_INSTALL_PREFIX`作为安装动态库和头文件的路径，则默认把动态库和头文件安装到系统路径`/usr/lib`和`usr/include`下。可用过`export MY_INSTALL_PREFIX=`加上本地文件路径来指定动态库和头文件的安装路径。

## 使用示例

编写示例程序
```cpp
#include <iostream>
#include <NMEAParser.h>

int main() {
    std::string rmcNmea = "$GNRMC,041704.000,A,2935.21718,N,10631.58906,E,0.00,172.39,071124,,,A*7E";
    std::string gsvNmea= "$GPGSV,4,1,13,02,09,305,24,10,72,161,34,12,19,048,32,21,15,288,18*7A";

    NmeaParser::NMEAParser parse;
    
    auto data = parse.parseNMEAMessage(rmcNmea);
    parse.dumpLocationInfo(data);

    data = parse.parseNMEAMessage(gsvNmea);
    parse.dumpLocationInfo(data);

    return 0;
}
```

编译并运行：
```
g++ main.cpp -std=c++17 -lNMEAParser -g
./a.out
```

运行结果：
```
locationMode: 3
utcTime: 946671424
latitude: 32.9697
latHemisphere: N
longitude: 116.128
lonHemisphere: E
speed: 0
course: 172.39
date: 071124
variation: 0
variationDirection: E
mode: A
totalMessages: 4
messageNumber: 1
satelliteCount: 13
satelliteID: 13
        elevation: 2
        azimuth: 9
        signalToNoiseRatio: 
satelliteID: 24
        elevation: 10
        azimuth: 72
        signalToNoiseRatio: 
satelliteID: 34
        elevation: 12
        azimuth: 19
        signalToNoiseRatio: 
satelliteID: 32
        elevation: 21
        azimuth: 15
        signalToNoiseRatio: 
satelliteID: 18
        elevation: 21
        azimuth: 15
        signalToNoiseRatio: 
```

1. 需要包含头文件`NMEAParser.h`
2. 编译时需要链接`libNMEAParser.so`，如果有指定动态库和头文件路径需要在你的`CMake`或编译指令中指定路径
3. 如果你想使用`dumpLocationInfo`进行定制化打印，只需要继承`NMEAParser`并重写`dumpLocationInfo`即可
```cpp title="override dumpLocationInfo"
#include <iostream>
#include <optional>
#include <memory>
#include <NMEAParser.h>

class MyNMEALocationInfoPrint : public NmeaParser::NMEAParser {
public:
    void dumpLocationInfo(std::optional<NMEAData>& data) {
        std::cout << "this is my own print." << std::endl;
        if (data->rmc) {
            std::cout << data->rmc->latitude << std::endl;
        }
    }
};

int main() {
    std::string rmcNmea = "$GNRMC,041704.000,A,2935.21718,N,10631.58906,E,0.00,172.39,071124,,,A*7E";
    std::string gsvNmea= "$GPGSV,4,1,13,02,09,305,24,10,72,161,34,12,19,048,32,21,15,288,18*7A";

    NmeaParser::NMEAParser parse;
    
    auto data = parse.parseNMEAMessage(rmcNmea);
    parse.dumpLocationInfo(data);

    // data = parse.parseNMEAMessage(gsvNmea);
    // parse.dumpLocationInfo(data);

    std::cout << "---------------------" << std::endl;

    std::unique_ptr<NmeaParser::NMEAParser> np = std::make_unique<MyNMEALocationInfoPrint>();
    np->dumpLocationInfo(data);

    return 0;
}
```
编译运行如下：
```shell
locationMode: 3
utcTime: 946671424
latitude: 32.9697
latHemisphere: N
longitude: 116.128
lonHemisphere: E
speed: 0
course: 172.39
date: 071124
variation: 0
variationDirection: E
mode: A
---------------------
this is my own print.
32.9697
```
**注意：在使用诸如`data->rmc`时应先判断是否为空！！！**

如果需要将定位信息个性化存储起来，还提供了`saveLocationInfo`，默认存储路径在`./output.txt`，你也可以自己指定一个保存路径：
```cpp
#include <iostream>
#include <optional>
#include <memory>
#include <fstream>
#include <string>
#include <vector>
#include <NMEAParser.h>
#include <charconv>

class MyNMEALocationInfoPrint : public NmeaParser::NMEAParser {
public:
    void dumpLocationInfo(std::optional<NMEAData>& data) {
        std::cout << "this is my own print." << std::endl;
        if (data->rmc) {
            std::cout << data->rmc->latitude << std::endl;
        }
    }

    void saveLocationInfo(std::optional<NMEAData> &op, const std::string& fp) {
        static int cnt = 1;
        std::ofstream os(fp, std::ios::app);
        if (!os.is_open()) {
            std::cerr << "open " << fp << " failed!!!" << std::endl;
        }
        if (op && op->rmc) {
            os << op->rmc->longitude << "," << op->rmc->latitude << ",0," << "m" << cnt << std::endl;
            cnt++;
        }
        os.close();
    }
};

int main() {
    std::string rmcNmea = "$GNRMC,041704.000,A,2935.21718,N,10631.58906,E,0.00,172.39,071124,,,A*7E";
    std::string gsvNmea= "$GPGSV,4,1,13,02,09,305,24,10,72,161,34,12,19,048,32,21,15,288,18*7A";

    NmeaParser::NMEAParser parse;
    
    auto data = parse.parseNMEAMessage(rmcNmea);
    parse.dumpLocationInfo(data);

    data = parse.parseNMEAMessage(gsvNmea);
    parse.dumpLocationInfo(data);

    std::cout << "---------------------" << std::endl;

    // print your own base location info for RMC
    std::unique_ptr<NmeaParser::NMEAParser> np = std::make_unique<MyNMEALocationInfoPrint>();
    np->dumpLocationInfo(data);

    std::cout << "---------------------" << std::endl;

    // save your own info
    std::ofstream os("output.txt");
    if (!os.is_open()) {
        std::cerr << "open output.txt failed!!!" << std::endl;
    }
    os << "Longitude,Latitude,Elevation,name" << std::endl;
    os.close();

    std::ifstream is("test.txt");
    if (!is.is_open()) {
        std::cerr << "open test.txt failed!!!" << std::endl;
    }
    std::string nmea;
    while(std::getline(is, nmea)) {
        auto tp = parse.parseNMEAMessage(nmea);
        np->saveLocationInfo(tp, "output.txt");
    }
    is.close();

    return 0;
}
```
*注：`test.txt`是我本地的NMEA原始报文文本文件，内容如下：*
```
$GPGGA,151139.468,2232.890,N,11357.815,E,1,12,1.0,0.0,M,0.0,M,,*67
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151139.468,A,2232.890,N,11357.815,E,187.3,174.1,111224,000.0,W*78
$GPGGA,151140.468,2232.839,N,11357.821,E,1,12,1.0,0.0,M,0.0,M,,*6D
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151140.468,A,2232.839,N,11357.821,E,161.5,173.9,111224,000.0,W*73
$GPGGA,151141.468,2232.794,N,11357.826,E,1,12,1.0,0.0,M,0.0,M,,*63
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151141.468,A,2232.794,N,11357.826,E,171.1,171.4,111224,000.0,W*77
$GPGGA,151142.468,2232.747,N,11357.834,E,1,12,1.0,0.0,M,0.0,M,,*6D
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151142.468,A,2232.747,N,11357.834,E,166.9,171.1,111224,000.0,W*72
$GPGGA,151143.468,2232.701,N,11357.842,E,1,12,1.0,0.0,M,0.0,M,,*6F
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151143.468,A,2232.701,N,11357.842,E,104.2,170.5,111224,000.0,W*7A
$GPGGA,151144.468,2232.673,N,11357.847,E,1,12,1.0,0.0,M,0.0,M,,*69
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151144.468,A,2232.673,N,11357.847,E,212.1,200.1,111224,000.0,W*7B
$GPGGA,151145.468,2232.618,N,11357.825,E,1,12,1.0,0.0,M,0.0,M,,*61
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151145.468,A,2232.618,N,11357.825,E,133.4,264.5,111224,000.0,W*70
$GPGGA,151146.468,2232.614,N,11357.785,E,1,12,1.0,0.0,M,0.0,M,,*6B
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151146.468,A,2232.614,N,11357.785,E,201.1,280.2,111224,000.0,W*70
$GPGGA,151147.468,2232.624,N,11357.726,E,1,12,1.0,0.0,M,0.0,M,,*60
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151147.468,A,2232.624,N,11357.726,E,171.4,359.3,111224,000.0,W*7E
$GPGGA,151148.468,2232.671,N,11357.725,E,1,12,1.0,0.0,M,0.0,M,,*6C
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151148.468,A,2232.671,N,11357.725,E,154.6,356.0,111224,000.0,W*7B
$GPGGA,151149.468,2232.714,N,11357.722,E,1,12,1.0,0.0,M,0.0,M,,*68
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151149.468,A,2232.714,N,11357.722,E,197.1,359.4,111224,000.0,W*7C
$GPGGA,151150.468,2232.769,N,11357.721,E,1,12,1.0,0.0,M,0.0,M,,*69
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151150.468,A,2232.769,N,11357.721,E,187.0,023.6,111224,000.0,W*71
$GPGGA,151151.468,2232.816,N,11357.744,E,1,12,1.0,0.0,M,0.0,M,,*6C
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151151.468,A,2232.816,N,11357.744,E,092.0,077.9,111224,000.0,W*7F
$GPGGA,151152.468,2232.822,N,11357.771,E,1,12,1.0,0.0,M,0.0,M,,*6E
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151152.468,A,2232.822,N,11357.771,E,101.8,081.5,111224,000.0,W*7B
$GPGGA,151153.468,2232.826,N,11357.801,E,1,12,1.0,0.0,M,0.0,M,,*63
$GPGSA,A,3,01,02,03,04,05,06,07,08,09,10,11,12,1.0,1.0,1.0*30
$GPRMC,151153.468,A,2232.826,N,11357.801,E,101.8,081.5,111224,000.0,W*76
```
编译运行如下：
```shell
locationMode: 3
utcTime: 946671424
latitude: 29.587
latHemisphere: N
longitude: 106.526
lonHemisphere: E
speed: 0
course: 172.39
date: 071124
variation: 0
variationDirection: E
mode: A
locationMode: 1
totalMessages: 4
messageNumber: 1
satelliteCount: 13
satelliteID: 2
        elevation: 9
        azimuth: 305
        signalToNoiseRatio: 24
satelliteID: 10
        elevation: 72
        azimuth: 161
        signalToNoiseRatio: 34
satelliteID: 12
        elevation: 19
        azimuth: 48
        signalToNoiseRatio: 32
satelliteID: 21
        elevation: 15
        azimuth: 288
        signalToNoiseRatio: 18
---------------------
this is my own print.
---------------------
```
当前路径生成的`output.txt`内容如下：
```
Longitude,Latitude,Elevation,name
113.964,22.5482,0,m1
113.964,22.5473,0,m2
113.964,22.5466,0,m3
113.964,22.5458,0,m4
113.964,22.545,0,m5
113.964,22.5445,0,m6
113.964,22.5436,0,m7
113.963,22.5436,0,m8
113.962,22.5437,0,m9
113.962,22.5445,0,m10
113.962,22.5452,0,m11
113.962,22.5461,0,m12
113.962,22.5469,0,m13
113.963,22.547,0,m14
113.963,22.5471,0,m15
```
这个格式仅供演示。使用《图新地图》把点打印在地图中，如下所示：

<img src="https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20241223211536.png"/>

使用[NMEA Parser](https://github.com/mo-xiaoxiu/Gnss-NMEA-data-process.git)所在NMEA解析器解析后打点对比如下（绿色点为[NMEA Parser](https://github.com/mo-xiaoxiu/Gnss-NMEA-data-process.git)）：

<img src="https://myblog-1308923350.cos.ap-guangzhou.myqcloud.com/img/20241223212210.png"/>

可以看到还是有一点位置偏差的，为C++使用`atof`转换的精度缺失带来的问题。后续看如何改进精度。

## 异步解析
该项目还提供了异步解析NMEA报文的接口，分别是以下两种使用方式：
1. 使用`parseNMEAMessageAsync`接口将NMEA原始报文传入，并调用`getFutureParserNMEAAsync`获取接口，实现上是使用`std::future`来获取异步执行的结果。使用示例如下：
```cpp
#include <iostream>
#include <optional>
#include <fstream>
#include <string>
#include <NMEAParser.h>

int main() {
    std::string rmcNmea = "$GNRMC,041704.000,A,2935.21718,N,10631.58906,E,0.00,172.39,071124,,,A*7E";
    std::string gsvNmea= "$GPGSV,4,1,13,02,09,305,24,10,72,161,34,12,19,048,32,21,15,288,18*7A";

    NmeaParser::NMEAParser parse;

    std::cout << "--------------------" << std::endl;

    parse.parseNMEAMessageAsync(rmcNmea);
    auto data = parse.getFutureParserNMEAAsync();

    parse.dumpLocationInfo(data);

    return 0;
}
```
编译运行结果如下：
```shell
--------------------
locationMode: 3
utcTime: 946671424
latitude: 29.587
latHemisphere: N
longitude: 106.526
lonHemisphere: E
speed: 0
course: 172.39
date: 071124
variation: 0
variationDirection: E
mode: A
```
2. 使用`setParserCallback`接口设置一个入参为`std::optional<NmeaParser::NMEAParser::NMEAData>&`的回调，并调用`startParse`接口传入NMEA原始报文进行异步解析，该接口会使用`std::thread`执行用户回调。使用示例如下：
```cpp
#include <iostream>
#include <optional>
#include <memory>
#include <fstream>
#include <string>
#include <NMEAParser.h>
#include <unistd.h>

int main() {
    std::string rmcNmea = "$GNRMC,041704.000,A,2935.21718,N,10631.58906,E,0.00,172.39,071124,,,A*7E";
    std::string gsvNmea= "$GPGSV,4,1,13,02,09,305,24,10,72,161,34,12,19,048,32,21,15,288,18*7A";

    NmeaParser::NMEAParser parse;

    std::cout << "--------------------" << std::endl;

    parse.setParserCallback([](std::optional<NmeaParser::NMEAParser::NMEAData>& data) {
        if (data && data->rmc) {
            std::cout << data->rmc->latitude << std::endl;
        }
    });
    parse.startParse(rmcNmea);

    while(1){
        sleep(1);
    }

    return 0;
}
```
编译运行结果如下：
```shell
--------------------
29.587
```