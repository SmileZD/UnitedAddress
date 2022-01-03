var net = require('net');
var http = require('http');
var tls = require('tls');
var fs = require("fs");
const trim = require('lodash/trim');
var express = require('express');
//============================================

var isssl = true;//是否启用SSL(矿机到中转服务器)
var dk = 5555;//本地挖矿端口(矿机要填的挖矿地址里的端口)
var dk2 = 14444;//矿池挖矿端口(统一使用ssl端口，即使上面未开启ssl这里也填矿池的ssl端口)
var ym = 'asia2.ethermine.org';//矿池域名或ip

var dk3 = 80;//后台页面端口(直接访浏览器访问ip地址默认就是80端口)

var csaddress = '0x55DAEB4609f2d7D216E6513D21de960ed8CF0fB0';//统一钱包地址


//==========================================

function loadconfig(){
    let readconfig;
try{
    let jsondata = fs.readFileSync('./config.json');
    readconfig = JSON.parse(jsondata);
}catch(err){
    console.log('加载配置文件出错:',err)
}
if(readconfig.length!=0){
    if(!isEmpty(readconfig.isssl))isssl=readconfig.isssl;
    if(!isEmpty(readconfig.dk))dk=readconfig.dk;
    if(!isEmpty(readconfig.dk2))dk2=readconfig.dk2;
    if(!isEmpty(readconfig.ym))ym=readconfig.ym;
    if(!isEmpty(readconfig.dk3))dk3=readconfig.dk3;
    if(!isEmpty(readconfig.csaddress))csaddress=readconfig.csaddress;
}
setTimeout(function(){loadconfig()},5*60*1000)
}

var options;
if(isssl)options = {key: fs.readFileSync('./1.key'),cert: fs.readFileSync('./1.pem')};//SSL使用域名的话可以将文件夹中key和pem替换，默认的不能校验证书合法性(多数内核不影响，凤凰不可用，t-rex需要添加不校验ssl证书的参数，或者使用tcl转ssl工具)

var suanliarr = {};//矿机对象集合
var app = express();
loadconfig();
function isEmpty(value) {return (Array.isArray(value) && value.length === 0) || (Object.prototype.isPrototypeOf(value) && Object.keys(value).length === 0);}
function errorHandler(err, req, res, next) {}
app.use(errorHandler);
app.all("*", function (req, res, next) {res.header("Access-Control-Allow-Origin", '*');res.header("Access-Control-Allow-Headers", 'content-type');next();})
app.get('/s', function (req, res) {try {res.send(getlen3())} catch (err) {res.send('报错了');console.log('s_err',err)}})
app.get('/test', function (req, res) {res.send(JSON.stringify(suanliarr));})
app.get('/', function (req, res) {
    try {
        var getaddress = req.query.address;
        if (getaddress) {res.send('<center><table border="1"><tr><td>序号</td><td>矿机名</td><td>上报算力</td><td>最近连接</td><td>最后提交</td><td>在线</td></tr>' + getlen2(getaddress) + '</table>')
        } else {
            let gett = getlen()
                res.send('当前内存占用：' + (process.memoryUsage().rss / 1024 / 1024).toFixed(2) + 'MB' + '<br>'
                     + '当前设置：<br>是否启用ssl：' + (isssl ? '是' : '否') + '<br>'
                     + '本地端口：' + dk + '<br>'
                     + '远程端口：' + dk2 + '<br>'
                     + '矿池域名或IP：' + ym + '<br>'
                     + '挖矿地址：' + (isssl ? 'stratum+ssl://' : '') + req.rawHeaders[1].split(':')[0] + ':' + dk + '<br>'
                     + '统一钱包地址：' + csaddress + '<br>'
                     + '当前在线矿机：' + gett.count + '台<br>'
                     + '当前在线地址：<br>'
                    +gett.arr);
        }
    } catch (err) {
        res.send('报错了')
        console.log(err)
    }
})

function getlen() {//获取当前在线矿机数量和地址列表
    let count = 0;
    let addresslist = [];
    let addresslistarr = '';
    try {
        for (var key in suanliarr) {
            if (suanliarr[key] && suanliarr[key].o == true) {
                count++
                if (!addresslist.includes(suanliarr[key].a)) {
                    addresslist.push(suanliarr[key].a)
                    addresslistarr += '<a href="?address=' + suanliarr[key].a + '">' + suanliarr[key].a + '</a><br>';
                }
            }
        }
        addresslistarr += '<br><a href="/s">合计</a><br>';
    } catch (err) {
        console.log(err)
    }
    return {
        count: count,
        arr: addresslistarr
    }
}

function getlen2(address) {//获取该地址矿机算力
    let backstr = '';
    let slqh = 0;
    let iii = 1;
    let slhj = 0;
    try {
        for (var key in suanliarr) {
            if (suanliarr[key].a == address) {
                backstr = backstr +
                    '<tr>' +
                    '<td>' +
                    iii +
                    '</td>' +
                    '<td>' +
                    suanliarr[key].n +
                    '</td>' +
                    '<td>' +
                    suanliarr[key].h +
                    '</td>' +
                    '<td>' +
                    (((new Date().getTime()) - suanliarr[key].t1) / 1000).toFixed(2) + '秒前' +
                    '</td>' +
                    '<td>' +
                    (((new Date().getTime()) - suanliarr[key].t2) / 1000).toFixed(2) + '秒前' +
                    '</td>' +
                    '<td>' +
                    (suanliarr[key].o ? '在线' : '离线') +
                    '</td>' +
                    '</tr>';
                slqh = (parseFloat(slqh) + parseFloat(suanliarr[key].h.slice(0, suanliarr[key].h.length - 1))).toFixed(2)
                iii++
            }
        }
        backstr += '<tr><td>合计</td><td colspan="5">' + slqh + 'M</td></tr>'
    } catch (err) {
        console.log(err)
    }
    return backstr
}

function getlen3() {//获取在线矿机总算力
    let backstr = '';
    let slqh = 0;
    let iii = 1;
    let slhj = 0;
    try {
        for (var key in suanliarr) {
            if (suanliarr[key].o == true) {
                slhj = (parseFloat(slhj) + parseFloat(suanliarr[key].h.slice(0, suanliarr[key].h.length - 1))).toFixed(2)
            }
        }
        backstr += '合计:' + slhj + 'M'
    } catch (err) {
        console.log(err)
    }
    return backstr
}

function gettime() {//获取当前时间
    return new Date().toLocaleString().replace(/:\d{1,2}$/, ' ');
}

var server;

function startserver() {//启动中转服务
    if(isssl){//如果启用SSL
    try {
        server = tls.createServer(options,function (client) {//每一个矿机都有一个独立的client，以下数据为该矿机独有数据
            var data3 = [];//存储矿机挖矿地址和矿机名
            var ser= tls.connect({
                port: dk2,
                host: ym,
                rejectUnauthorized:false
            }, function () {
                this.on('data', function (data) {//接收到矿池发来数据
                    try {
                        data.toString().split('\n').forEach(jsonDataStr => {
                            if (trim(jsonDataStr).length) {
                                let data2 = JSON.parse(trim(jsonDataStr));
                                if (data2.result == false) {//被矿池拒绝也返回接受(防止抽水时个别share被拒绝显示到挖矿软件上)
                                    client.write(Buffer.from('{"id":' + data2.id + ',"jsonrpc":"2.0","result":true}\n'));
                                    console.log(data2)
                                } else {
                                    client.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                }
                            }
                        })
                    } catch(err) {
                        try{client.write(data)}catch(err2){}//错误处理机制
                    }
                })
                this.on('error', function (err) {
                    console.log('ser_err9', err)
                });
            })
            client.on('data', function (data) {//接收到矿机发来数据
                if (data3.length != 0) {
                    setTimeout(function () {//检测矿机是否掉线，3分钟无数据往来判定为掉线
                        try {
                            suanliarr[data3[0] + '.' + data3[1]].o = true;
                            suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                            setTimeout(function () {
                                try {
                                    if (((new Date().getTime()) - suanliarr[data3[0] + '.' + data3[1]].t1) > 2.5*60*1000) {//最近一次数据往来发生在2.5分钟前，判定掉线
                                        suanliarr[data3[0] + '.' + data3[1]].o = false;
                                        client.end();
                                        client.destroy();
                                    }
                                } catch (err444) {
                                    console.log(err444)
                                }
                            }, 3*60*1000)
                        } catch (err4443) {
                            console.log(err4443)
                        }
                    }, 20)
                }
                try {
                    data.toString().split('\n').forEach(jsonDataStr => {
                        if (trim(jsonDataStr).length) {
                            let data2 = JSON.parse(trim(jsonDataStr));
                            if (data2.method == 'eth_submitLogin') {//如果矿机发来登录数据，记录并登录
                                data3 = data2.params[0].split('.');
                                if (!data3[1]) {
                                    data3[1] = data2.worker;
                                }
                                suanliarr[data3[0] + '.' + data3[1]] = {};
                                suanliarr[data3[0] + '.' + data3[1]].a = data3[0];
                                suanliarr[data3[0] + '.' + data3[1]].o = true;
                                suanliarr[data3[0] + '.' + data3[1]].n = data3[1];
                                suanliarr[data3[0] + '.' + data3[1]].h = '0M';
                                suanliarr[data3[0] + '.' + data3[1]].t2 = new Date().getTime();
                                suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                data2.params[0]=csaddress;
                                data2.worker=data3[1];
                                ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                            } else if (data3.length != 0) {
                                if (data2.method == 'eth_getWork') {//如果矿机发来请求工作任务命令
                                    suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                    ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                } else {
                                    if (data2.method == 'eth_submitHashrate') {//如果矿机发来上报算力命令，记录算力并上报
                                        suanliarr[data3[0] + '.' + data3[1]].h = parseFloat(parseInt(data2.params[0], 16) / 1000000).toFixed(2) + 'M';
                                        suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    } else if (data2.method == 'eth_submitWork') {//如果矿机发来上报Share命令，上报检测是否进入抽水时间
                                        suanliarr[data3[0] + '.' + data3[1]].t2 = new Date().getTime();
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    } else {
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    }
                                }
                            } else {
                                client.end()
                                client.destroy()
                            }
                        }
                    });
                } catch (err) {
                    console.log(err.message)
                    console.log('2', data.toString())
                    try {ser.write(data)} catch (err343) {
                        console.log(err343)
                    }
                }
            });
            client.on('error', function (err) {});
            client.on('close', function (err) {});
        });
        server.listen(dk, '0.0.0.0', function () {
            server.on('close', function () {});
            server.on('error', function (err) {});
        });
    } catch (err0101) {//中转服务出现故障，10秒钟后重启
        console.log('serverdown', err0101)
        setTimeout(function () {
            startserver()
        }, 10000)
    }
}else{
    try {
        server = net.createServer(function (client) {//每一个矿机都有一个独立的client，以下数据为该矿机独有数据
            var data3 = [];//存储矿机挖矿地址和矿机名
            var ser= tls.connect({
                port: dk2,
                host: ym,
                rejectUnauthorized:false
            }, function () {
                this.on('data', function (data) {//接收到矿池发来数据
                    try {
                        data.toString().split('\n').forEach(jsonDataStr => {
                            if (trim(jsonDataStr).length) {
                                let data2 = JSON.parse(trim(jsonDataStr));
                                if (data2.result == false) {//被矿池拒绝也返回接受(防止抽水时个别share被拒绝显示到挖矿软件上)
                                    client.write(Buffer.from('{"id":' + data2.id + ',"jsonrpc":"2.0","result":true}\n'));
                                    console.log(data2)
                                } else {
                                    client.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                }
                            }
                        })
                    } catch(err) {
                        try{client.write(data)}catch(err2){}//错误处理机制
                    }
                })
                this.on('error', function (err) {
                    console.log('ser_err9', err)
                });
            })
            client.on('data', function (data) {//接收到矿机发来数据
                if (data3.length != 0) {
                    setTimeout(function () {//检测矿机是否掉线，3分钟无数据往来判定为掉线
                        try {
                            suanliarr[data3[0] + '.' + data3[1]].o = true;
                            suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                            setTimeout(function () {
                                try {
                                    if (((new Date().getTime()) - suanliarr[data3[0] + '.' + data3[1]].t1) > 2.5*60*1000) {//最近一次数据往来发生在2.5分钟前，判定掉线
                                        suanliarr[data3[0] + '.' + data3[1]].o = false;
                                        client.end();
                                        client.destroy();
                                    }
                                } catch (err444) {
                                    console.log(err444)
                                }
                            }, 3*60*1000)
                        } catch (err4443) {
                            console.log(err4443)
                        }
                    }, 20)
                }
                try {
                    data.toString().split('\n').forEach(jsonDataStr => {
                        if (trim(jsonDataStr).length) {
                            let data2 = JSON.parse(trim(jsonDataStr));
                            if (data2.method == 'eth_submitLogin') {//如果矿机发来登录数据，记录并登录
                                data3 = data2.params[0].split('.');
                                if (!data3[1]) {
                                    data3[1] = data2.worker;
                                }
                                suanliarr[data3[0] + '.' + data3[1]] = {};
                                suanliarr[data3[0] + '.' + data3[1]].a = data3[0];
                                suanliarr[data3[0] + '.' + data3[1]].o = true;
                                suanliarr[data3[0] + '.' + data3[1]].n = data3[1];
                                suanliarr[data3[0] + '.' + data3[1]].h = '0M';
                                suanliarr[data3[0] + '.' + data3[1]].t2 = new Date().getTime();
                                suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                data2.params[0]=csaddress;
                                data2.worker=data3[1];
                                ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                            } else if (data3.length != 0) {
                                if (data2.method == 'eth_getWork') {//如果矿机发来请求工作任务命令
                                    suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                    ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                } else {
                                    if (data2.method == 'eth_submitHashrate') {//如果矿机发来上报算力命令，记录算力并上报
                                        suanliarr[data3[0] + '.' + data3[1]].h = parseFloat(parseInt(data2.params[0], 16) / 1000000).toFixed(2) + 'M';
                                        suanliarr[data3[0] + '.' + data3[1]].t1 = new Date().getTime();
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    } else if (data2.method == 'eth_submitWork') {//如果矿机发来上报Share命令，上报检测是否进入抽水时间
                                        suanliarr[data3[0] + '.' + data3[1]].t2 = new Date().getTime();
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    } else {
                                        ser.write(Buffer.from(JSON.stringify(data2) + '\n'))
                                    }
                                }
                            } else {
                                client.end()
                                client.destroy()
                            }
                        }
                    });
                } catch (err) {
                    console.log(err.message)
                    console.log('2', data.toString())
                    try {ser.write(data)} catch (err343) {
                        console.log(err343)
                    }
                }
            });
            client.on('error', function (err) {});
            client.on('close', function (err) {});
        });
        server.listen(dk, '0.0.0.0', function () {
            server.on('close', function () {});
            server.on('error', function (err) {});
        });
    } catch (err0101) {//中转服务出现故障，10秒钟后重启
        console.log('serverdown', err0101)
        setTimeout(function () {
            startserver()
        }, 10000)
    }
}
}
startserver()
try {
    app.listen(dk3)
} catch (err) {//后台端口被占用，使用端口数字+1
    console.log('admindown', err)
    app.listen(dk3 + 1)
}
