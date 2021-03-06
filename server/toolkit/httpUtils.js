﻿///<reference path="../tslib/node.d.ts" />
var http = require('http');
var config = eval('require("../config.js")');


//简单ip随机算法
function getBalanceIPRandomKey(ip) {
    var list = ip.split(".");
    var i = list.length, count = 0;
    while (i--) {
        count += +list[i];
    }
    return count;
}

//得到负载均衡的ip主机
function getBalanceIP(host, serverMap, clientIP) {
    var len, serverList = serverMap[host] || [];
    if (len = serverList.length) {
        host = serverList[getBalanceIPRandomKey(clientIP) % len];
        console.log("getBalanceIP:" + host);
    }
    return host;
}

function request(options, requestData, callback) {
    var fiddlerMode = config.fiddlerMode;

    var host = fiddlerMode ? "127.0.0.1" : options.hostname;
    var port = fiddlerMode ? 8888 : (options.port || 80);

    //多服务器负载， 同时具备 域名->内网IP的作用
    if (!fiddlerMode && config.BalanceList && options.clientIP) {
        host = getBalanceIP(host, config.BalanceList, options.clientIP);
        port = host.indexOf(":") > -1 ? host.split(":")[1] : 80;
        host = host.indexOf(":") > -1 ? host.split(":")[0] : host;
    }

    var request = http.request({
        headers: options.headers,
        hostname: host,
        port: port,
        path: options.path,
        method: options.method || "POST"
    }, function (res) {
        var buffers = [];
        var allLength = 0;
        res.on("data", function (chunk) {
            buffers.push(chunk);
            allLength += chunk.length;
        });
        res.on("end", function () {
            var buf, chunk;
            clearTimeout(timeoutTimer);
            if (res.statusCode == 200) {
				buf = Buffer.concat(buffers, allLength);
                callback({
                    isSuccess: true,
                    responseBody: buf,
                    contentLength: allLength,
                    httpStatus: res.statusCode
                });
            } else {
                callback({
                    isError: true,
                    httpStatus: res.statusCode
                });
            }
        });
    });
    var isHandledTimeout = false;
    request.on("error", function (e) {
        clearTimeout(timeoutTimer);
        if (!isHandledTimeout) {
            callback({
                isError: true,
                errorMsg: JSON.stringify(e)
            });
        }
    });
    var timeoutTimer = setTimeout(function () {
        isHandledTimeout = true;
        callback({
            isTimeout: true
        });
        request.abort(); //这样会抛出异常，被error捕获
    }, options.timeout || 10000);
    if (requestData) {
        request.write(requestData);
    }
    request.end();
    return request;
}
exports.request = request;
