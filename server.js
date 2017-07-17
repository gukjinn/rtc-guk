var	express = require('express');
var	app = express();
var	config = require('./config.json');
var	bodyParser = require('body-parser');
var fs = require('fs');
var options = {  
    key: fs.readFileSync('./go/private.pem'),
    cert: fs.readFileSync('./go/public.pem')
};
// for socket server
var	http = require('http').Server(app);
var	io = require('socket.io')(http);
var port = process.env.PORT || config.webserver.port;


app.set('views', __dirname + '/views');
app.engine('ejs', require('ejs').renderFile);
app.use(express.static(__dirname + '/contents'));
app.use(express.static(__dirname + '/views'));
app.use(bodyParser.urlencoded({
	extended : true
 }));
app.use(bodyParser.json());

app.post("/conference/", function(request, response){
  // form에서 전송된 내용은 request에 담겨 있습니다.
  // request.body.email에서 .email은 input 요소의 name attribute 입니다.(pwd >동일한 방식)
  var username= request.body.username;
  console.log(request.body);
   var obj = {user: username};

    response.render("conference/index.ejs", {  user: username});
});


/**
 * ROUTE
 */
app.get('/', function(req, res){
	res.render('index.ejs', {
		title:""
	});
}).get('/conference', function(req, res) {
	res.render('conference/index.ejs', {
	user:"",
	room:""
  });
});

function findRoomBySocketId(value) {
	var arr = Object.keys(rooms);
	var result = null;
	for (var i=0; i<arr.length; i++) {
		if (rooms[arr[i]][value]) {
			result = arr[i];
			break;
		}
	}

	console.log('나간 룸', result);
	return result;
}

/**
 * SOCKET
 */
var rooms = {};
var roomId = null;
var socketIds = {};
var userList = {};

io.on('connection', function(socket) {
  socket.on('joinRoom', function(roomName, userId) {
    roomId = roomName; //룸에 합류하려면.... 특정 룸에 바인딩
		socket.join(roomId);  // 소켓을 특정 room에 binding합니다.
	
		// 룸에 사용자 정보 추가
		// 이미 룸이 있는경우
		if (rooms[roomId]) { 
			console.log('이미 룸이 있는 경우');
			rooms[roomId][socket.id] = userId; 
			
		// 룸 생성 후 사용자 추가
		} else {
			console.log('룸 추가');
			rooms[roomId] = {};
			console.log('룸 아이디', roomId);
			console.log('소켓 아이디',socket.id);
			rooms[roomId][socket.id] = userId;
			userList[0] = userId;
			//룸아이디 :https192931023123#werwer socketid:hzb45ae9rxf userId:1650533
		}
		thisRoom = rooms[roomId]; //
		console.log('thisRoom', thisRoom);
		
		// 유저 정보 추가
    io.sockets.in(roomId).emit('joinRoom', roomId, thisRoom); //그 방에 룸아이디와 룸안의 사용자들의 정보를 보낸다.
    //console.log('ROOM LIST', io.sockets.adapter.rooms);
		console.log('ROOM LIST', rooms);
  });

  // 메시징
  socket.on('message', function(data) {
    //console.log('message: ' + data);
	//데이터가 모든 사람에게이면 
    if (data.to == 'all') {
			// for broadcasting without me
			console.log("all: ",data);
      socket.broadcast.to(data.roomId).emit('message', data);
    } else {
      // for target user
      var targetSocketId = socketIds[data.to];
      if (targetSocketId) {
        io.to(targetSocketId).emit('message', data);
      }
    }
  });

  // socket disconnect
  socket.on('disconnect', function() {
    console.log('a user disconnected', socket.id); //현재연결된 소켓의 아이디
		var roomId = findRoomBySocketId(socket.id);
		if (roomId) {
			socket.broadcast.to(roomId).emit('leaveRoom', rooms[roomId][socket.id]); // 자신 제외 룸안의 유저ID 전달
			delete rooms[roomId][socket.id]; // 해당 유저 제거
			
		}
  });
});
//문제점 룸을 벗어나도 그 룸이 사라지지는 않았음.
// server listen start
http.listen(port, function() {
  console.log('WebRTC Lab server running at ' + config.webserver.host + ':' + port);
});
