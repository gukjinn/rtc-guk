/*!
 *
 * WebRTC Lab
 * @author7 dodortus (codejs.co.kr / dodortus@gmail.com)
 *
 */

/*!
  간략한 시나리오.
  1. offer가 SDP와 candidate전송
  2. answer는 offer가 보낸 SDP와 cadidate를 Set한다.
  3. answer는 응답할 SDP와 candidate를 얻어서 offer한테 전달한다.
  4. offer는 응답 받은 SDP와 candidate를 Set한다.
*/

/*
TODO
 - 파폭 처리
 - hasWebCam 분기
*/
$(function() {
  console.log('Loaded webrtc');

  // cross browsing // 표준 웹 킷브라우스
  navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia;
  var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
  var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
  var RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;

  // for logic
  var socket = io();
  var roomId = null;
  var userId = Math.round(Math.random() * 999999) + 999999;
  var remoteUserId = {};
  var isOffer = null;
  var localStream = null;
 // var peer ; 
  var peerConnections ={};  // offer or answer peer
  var userList = {};
  var dataChannel = {};
  var filename={};
  var count= 0;
  var count2 = 98 ;
  var count3 = 0; 
  var iceServers = {
    'iceServers': [{
      'url': 'stun:stun.l.google.com:19302'
    }, {
      'url': 'turn:107.150.19.220:3478',
      'credential': 'turnserver',
      'username': 'subrosa'
    }]
  };
  var peerConnectionOptions = {
    'optional': [{
      'DtlsSrtpKeyAgreement': 'true'
    }]
  };
  var mediaConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': true
    }
  };

  // DOM
  var $body = $('body');
  var $roomList = $('#room-list');
  var $videoWrap = $('#video-wrap');
  var $tokenWrap = $('#token-wrap');
  var $uniqueToken = $('#unique-token');
  var $joinWrap = $('#join-wrap');
  var $roomInput = $('#roomInput');
  var $userInput = $('#userInput'); 
  var $userInput2 = null;   
  var $chatArea = $('#chatArea');
 // var $sendMsgBtn = $('#sendMsgBtn');
 // var roomInput = document.querySelector('#roomInput'); 
 // var userInput = document.querySelector('#userInput'); 
  /**
  * getUserMedia
  */
  function getUserMedia() {
    console.log('getUserMedia');

    navigator.getUserMedia({
      audio: true,
      video: {
        mandatory: {
          // 720p와 360p 해상도 최소 최대를 잡게되면 캡쳐 영역이 가깝게 잡히는 이슈가 있다.
          // 1920 * 1080 | 1280 * 720 | 858 * 480 | 640 * 360 | 480 * 272 | 320 * 180
			maxWidth: 640,
			maxHeight: 360,
			minWidth: 320,
			minHeight: 180,
			maxFrameRate: 24,
			minFrameRate: 18,
			maxAspectRatio: 1.778,
			minAspectRatio: 1.777
		
        },
        optional: [
          {googNoiseReduction: true}, // Likely removes the noise in the captured video stream at the expense of computational effort.
          {facingMode: "user"}        // Select the front/user facing camera or the rear/environment facing camera if available (on Phone)
        ]
      }
    }, function(stream) {
      localStream = stream;
      $videoWrap.append('<video id="local-video" muted="muted" autoplay="true" src="' + URL.createObjectURL(localStream) + '"></video>');
	  $body.addClass('room wait');
      $tokenWrap.slideDown(1000);
	  //로컬 비디오 설정....
		//
      if (isOffer) {
			//조인하면 합류하면 Offer 제안을 만든다.
			var arr = Object.keys(userList);

			//var result = null;
			for ( var i = 0; i < arr.length; i++ ){
					console.log("우리아이디",userList[arr[i]]);
				createPeerConnection(userList[arr[i]]);
				 createOffer(userList[arr[i]]);
				 
			}
			//for each ( var item in 
           // for each( var item in arr){
			//	console.log("알아줘" , arr);
			//}
		 
        
		
      }
    }, function() {
      console.error('Error getUserMedia');
    });
  }

  /**
  * createOffer
  * offer SDP를 생성 한다.
  */
  function createOffer(id) {
    console.log('createOffer', arguments);
	//
	var peer = createPeerConnection(id);
	if(!peer){
		return;
	}
    peer.addStream(localStream); // addStream 제외시 recvonly로 SDP 생성됨
    peer.createOffer(function(SDP) {
      // url parameter codec=h264
      if (location.search.substr(1).match('h264')) {
        SDP.sdp = SDP.sdp.replace("100 101 107", "107 100 101"); // for chrome < 57
        SDP.sdp = SDP.sdp.replace("96 98 100", "100 96 98"); // for chrome 57 <
      }
		
      peer.setLocalDescription(SDP); 
      console.log("Sending offer description", SDP);
      send({
        sender: userId, 
		receiver: id,
        to: 'all', 
        sdp: SDP 
      });
    }, onSdpError, mediaConstraints);
  }

  /**
  * createAnswer
  * offer에 대한 응답 SDP를 생성 한다.
  * @param {object} msg offer가 보내온 signaling
  */
  function createAnswer(msg) {
    console.log('createAnswer', arguments);
	if(peerConnections[msg.sender]){
		return;
	
	}
	var peer  = createPeerConnection(msg.sender);
	
    peer.addStream(localStream); //메시지온놈을 설정하고
    peer.setRemoteDescription(new RTCSessionDescription(msg.sdp), function() {
      peer.createAnswer(function(SDP) {
        peer.setLocalDescription(SDP);
        console.log("Sending answer to peer.", SDP);
        send({
          sender: userId,
		  receiver: msg.sender,
          to: 'all',
          sdp: SDP
        });
      }, onSdpError, mediaConstraints);
    }, function() {
      console.error('setRemoteDescription', arguments);
    });
  }

  /**
  * createPeerConnection
  * offer, answer 공통 함수로 peer를 생성하고 관련 이벤트를 바인딩 한다.
  */
  function createPeerConnection(id) {
    console.log('createPeerConnection', arguments);
	//내가 아닌 피어에대해서 연결을 해야함..
	//peer[]
	if(id == userId){
		return;
	}
	
	if(peerConnections[id]){
			
			return peerConnections[id];
	}
	console.log("안녕");
	

	var pc = new RTCPeerConnection(iceServers, peerConnectionOptions); 
	peerConnections[id] = pc;
  
	
    console.log('new Peer', pc);

    pc.onicecandidate = function(event) {
      if (event.candidate) {
        send({
          userId: userId,
		  receiver: id,
          to: 'all',
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate
        });
      } else {
        console.info('Candidate denied', event.candidate);
      }
    };
	
  ///여기 피어에는 연결되는데 
    pc.onaddstream = function(event) {
      console.log("Adding remote strem", event);
			var arr = Object.keys(userList);
			
			if((count % 2) == 0){
				count2++;
				$videoWrap.append('<div id="'+String.fromCharCode(count2)+'" class="row">  </div>');
			}	
			
			
			$('#'+String.fromCharCode(count2)).append('<div id=a"'+userList[arr[count]]+'"> <video id="'+userList[arr[count]]+'" autoplay="true" src="' + URL.createObjectURL(event.stream) + '"></video></div>');
			count++;
			$body.removeClass('wait').addClass('connected');
		
			
						//connected;;
      //connected;;
    };

    pc.onremovestream = function(event) {
      console.log("Removing remote stream", event);
    };
	pc.ondatachannel = function(event) {
		
		  var receiveChannel = event.channel;
		 // receiveChannel.binaryType = 'arraybuffer';
		 // receiveChannel.onmessage = onReceiveMessageCallback;
		  //receiveChannel.onopen = onReceiveChannelStateChange;
		  //receiveChannel.onclose = onReceiveChannelStateChange;
		  receivedSize = 0;
		  bitrateMax = 0;
		  downloadAnchor.textContent = '';
		  downloadAnchor.removeAttribute('download');
		  if (downloadAnchor.href) {
			  URL.revokeObjectURL(downloadAnchor.href);
			  downloadAnchor.removeAttribute('href');
			  }
			  receiveChannel.onmessage = function(event) {
				  var a = 'b';
				  var data ;
				  var id;
				  var type;
				  var rawdata;
				  
				  console.log("타입",typeof event.data);
				  console.log(filename[userId]);
				  
				  if(typeof(event.data) =='string'){
					console.log("wefwefef");
					 
					$chatArea.append('<li class="odd">'+ event.data + '</li>'); 
					return;
				  }
				  else if(typeof(event.data) == 'object' && filename[userId]){
				//	var d = JSON.parse(event.data);
					console.log("ondatachannel message:", filename[userId]);
					//console.log("정말안된다.ㄴㄴ",event.data.rawdata);
						//console.log(event);
					//id = data.id;
					//type = data.type;
					//rawdata = data.rawdata;
					//console.log("rawdata", data.rawdata);
					
															
					receiveBuffer.push(event.data);
					receivedSize += event.data.byteLength;

					//receiveProgress.value = receivedSize;
					
  // we are assuming that our signaling protocol told
  // about the expected file size (and name, hash, etc).
  
					//var filename = fileInput.files[0];
					if (receivedSize === filename[userId].size) {
						var received = new window.Blob(receiveBuffer);
						receiveBuffer = [];
					
						//downloadAnchor.href = URL.createObjectURL(received);
						//downloadAnchor.download = filename[userId].name;
						//downloadAnchor.textContent =
						//	'클릭해라 \'' + filename[userId].name + '\' (' + filename[userId].size + ' bytes)';
						//downloadAnchor.style.display = 'block';
						$chatArea.append('<li class="odd">'+ '<a href="'+URL.createObjectURL(received)+'" download="'+filename[userId].name+'">'+filename[userId].name +'</li>');
						//var bitrate = Math.round(receivedSize * 8 /
						//	((new Date()).getTime() - timestampStart));
						//bitrateDiv.innerHTML = '<strong>Average Bitrate:</strong> ' +
					//	bitrate + ' kbits/sec (max: ' + bitrateMax + ' kbits/sec)';
						//$chatArea.append('<li class="odd">'+  + '</li>');
					if (statsInterval) {
					window.clearInterval(statsInterval);
						statsInterval = null;
					}
					filename[userId] = null;
					//closeDataChannels();
				}
			  }
			  
			};     
		}; 
		
      //creating data channel 
      dataChannel[id] = pc.createDataChannel("channel1", {reliable:true}); 
	  
      dataChannel[id].onerror = function (error) { 
         console.log("Ooops...error:", error); 
      };
	  //pc.binaryType = 'arraybuffer';
	  pc.onopen = onSendChannelStateChange;
	  pc.onclose = onSendChannelStateChange;
      //when we receive a message from the other peer, display it on the screen 
      pc.onmessage = function (event) { 
         
      }; 
		
      pc.onclose = function () { 
         console.log("data channel is closed"); 
      };
	
	
	  //fileInput.disabled = true;
	return pc;
  }

  /**
  * onSdpError
  */
  function onSdpError() {
    console.log('onSdpError', arguments);
  }

  /****************************** Below for signaling ************************/

  /**
  * send
  * @param {object} msg data
  */
  function send(data) {
    console.log('send', data);

    data.roomId = roomId;
    socket.send(data);
  }

  /**
  * onmessage
  * @param {object} msg data
  */
  function onmessage(data) {
    console.log('onmessage', data);

    var msg = data;
    var sdp = msg.sdp || null;
	var peer;
	var arr = Object.keys(userList);
	
    if (!remoteUserId[count3]) {
      remoteUserId[count3++] = data.userId; //원격유저아이디
    }
	console.log("받은자..", msg.receiver);
    // 접속자가 보내온 offer처리
    if (sdp) {
      if (sdp.type  == 'offer' && msg.receiver == userId ) {
        //createPeerConnection();
        console.log('Adding local stream...');
        createAnswer(msg);

      // offer에 대한 응답 처리
      } else if (sdp.type == 'answer' && msg.receiver == userId) {
        // answer signaling
		
		peer = createPeerConnection(msg.sender);
		if(!peer){
			return;
		}
        peer.setRemoteDescription(new RTCSessionDescription(msg.sdp));
      }

    // offer, answer cadidate처리
    } else if (msg.candidate && msg.receiver == userId) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: msg.label,
        candidate: msg.candidate
      });
	  peer = createPeerConnection(msg.userId);
	  if(!peer){
		return;
	  }
      peer.addIceCandidate(candidate);
    } else if(msg.type =="file_request" && msg.receiver == userId ){
		filename[msg.receiver] = {name: msg.filename, size: msg.size};
		console.log("보여줘",filename[msg.receiver]);
		send({
			type: "file_response",
			userId: userId,
			receiver: msg.userId,
			to: "all"
		});
      //console.log()
    } else if (msg.type == "file_response" && msg.receiver == userId ){
		console.log("보여줘wefwef",filename[msg.receiver]);
		sendData(msg.userId);
	} else if (msg.type == "file_end" && msg.receiver == userId){
		filename[msg.receiver] = null;
	}
  }
  
  /**
   * setRoomToken
   */
  function setRoomToken() {
    //console.log('setRoomToken', arguments);

    if (location.hash.length > 2) {
      $uniqueToken.attr('href', location.href);//hash가 있으면 그대로둠.
    } else {
		//location.hash = '#' + encodeURI(encodeURIComponent(tt));
		//var kk = encodeURI(encodeURIComponent(tt));
		//console.log(decodeURI(decodeURIComponent(kk)));
		location.hash = '#' + (Math.random() * new Date().getTime()).toString(32).toUpperCase().replace(/\./g, '-');
		//location.hash = '#' + (Math.random() * new Date().getTime()).toString(32).toUpperCase().replace(/\./g, '@');
	}
  }

  /**
   * setClipboard
   */
  function setClipboard() {
    //console.log('setClipboard', arguments);

    $uniqueToken.click(function(){
      var link = location.href;
      if (window.clipboardData){
        window.clipboardData.setData('text', link);
        $.message('Copy to Clipboard successful.');
      }
      else {
        window.prompt("Copy to clipboard: Ctrl+C, Enter", link); // Copy to clipboard: Ctrl+C, Enter
      }
    });
  }

  /**
   * onFoundUser
   */
  function onFoundUser() {
    $roomList.html([
      '<div class="room-info" class="col-md-12">',
        '<p>당신을 기다리고 있어요. 참여 하실래요?</p>',
		'<input type = "text" id = "userInput2" class ="form-control formgroup" placeholder ="user명" required="" autofocus = "">',
        '<button id="join">Join</button>',
      '</div>'].join('\n'));
    var $btnJoin = $('#join');
    $btnJoin.click(function() {
      isOffer = true;
	  
	  var tt = $('#userInput2').val();
	  if(!tt){
		alert('이름을 입력해주세요.');
		return;

	}
	  console.log("두번쨰는 왜안들어와:",tt);
	  userId = tt;
	  socket.emit('joinRoom', roomId, userId);
      getUserMedia();
      $(this).attr('disabled', true);
    });

    $joinWrap.slideUp(1000);
    $tokenWrap.slideUp(1000);
  }

  /**
   * onLeave
   * @param {string} userId
   */
  function onLeave(userId) {
	  console.log("아제발좀되라",userId);
	  var arr = Object.keys(userList);
	  
	  //ar c = userList[arr[userId]];
	var c = '#'+ userId;
		console.log("이상하다.",c);
     $('#bb').remove();
      $body.removeClass('connected').addClass('wait');
      //remoteUserId = null;
		userList[arr[userId]] = null;
    
	console.log("fefefe",remoteUserId);
	/*for(var i = 0 ; i < remoteUserId.length; i++){
			console.log("아아",userId);
	if (remoteUserId[i] == userId) {
		console.log("아아1",userId);
      $('#remote-video').remove();
      $body.removeClass('connected').addClass('wait');
      remoteUserId[i] = null;
	  count3--;
    }
	}*/
  } 

  function pauseVideo(callback) {
    console.log('pauseVideo', arguments);
    localStream.getVideoTracks()[0].enabled = false;
    callback && callback();
  }

  function resumeVideo(callback) {
    console.log('resumeVideo', arguments);
    localStream.getVideoTracks()[0].enabled = true;
    callback && callback();
  }

  function muteAudio(callback) {
    console.log('muteAudio', arguments);
    localStream.getAudioTracks()[0].enabled = false;
    callback && callback();
  }

  function unmuteAudio(callback) {
    console.log('unmuteAudio', arguments);
    localStream.getAudioTracks()[0].enabled = true;
    callback && callback();
  }

  /**
   * initialize
   */
  function initialize() {
	  console.log("헤쉬길이",location.hash.length);
	 if(location.hash.length > 2){
		 var tt = '';		 
		 setRoomToken();
		 setClipboard();
		 roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
		 onFoundUser(); 
		// socket.emit('joinRoom', roomId, userId);
  
	}
	//룸아이디는 에네들다지움
    $(document).ready(function() {
		
		var tt2 = $('#user').text();
		if(tt2 == ' ')
			return;
		console.log('ㄹㄹㄹㄹㄹㄹ',tt2);
		//if(!tt2){
//			alert("이름을 입력해주세요.");
//			return;
		
//		}
		console.log("재발나와라",tt);
			setRoomToken(); //룸토큰만들고
			setClipboard(); // 클립보드 만듥로
			
			roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
			
			userId = tt2;
			socket.emit('joinRoom', roomId, userId);
			getUserMedia();
    }); //start가 클릭되면 겟유저미디어시작하고.

    $('#btn-camera').click(function() {
      var $this = $(this);
      $this.toggleClass('active');

      if ($this.hasClass('active')) {
        pauseVideo();
      } else {
        resumeVideo();
      }
    });
	
	$('#file-drop').on("drop", function(event){
		var idx = 0,
        file = null,
        files = e.target.files || e.dataTransfer.files;

		while( idx < files.length ) {
				file = files[ idx++ ];
				console.log("파일");
		}

		e.stopPropagation( );
		e.preventDefault( );
	});
	
    $('#btn-mic').click(function() {
      var $this = $(this);
      $this.toggleClass('active');

      if ($this.hasClass('active')) {
        muteAudio();
      } else {
        unmuteAudio();
      }
    });
	$('#sendMsgBtn').click (function () { 
		var val = msgInput.value; 
   
		$chatArea.append('<li class="even">'+ userId + ' : '  + val + '</li>'); 
	//$videoWrap.append('<video id="remote-video" autoplay="true" src="' + URL.createObjectURL(event.stream) + '"></video>');
   //sending a message to a connected peer 

		var arr = Object.keys(userList);
   //console.log(userList[arr[]]);
		for ( var i = 0; i < arr.length; i++ ){
			if(dataChannel[userList[arr[i]]] != null)
			dataChannel[userList[arr[i]]].send(userId +': '+ val); 
			
		}
		msgInput.value = ""; 
	});
  }
  initialize();
function drag_over(event){
	event.stopPropagation();
	event.preventDefault();
}
  /**
   * socket handling
   */
 // socket.emit('joinRoom', roomId, userId);
  socket.on('joinRoom', function(roomId, thisRoom) {
    console.log('joinRoom', arguments);
	userList = thisRoom;
		console.log("뭔지알아야",roomId);
	
	
	console.log("우리의 룸",thisRoom);
   // if (Object.size(thisRoom) > 1) {
	//	console.log("werwerwerwer");
   //   onFoundUser(); //userList 1보다 크면 
   // }
  });
  
  socket.on('leaveRoom', function(userId) {
    console.log('leaveRoom', arguments);
    onLeave(userId);// 룸을떠날때
  });

  socket.on('message', function(data) {
    onmessage(data);
  });

var sendChannel; // 보내는 채널
var receiveChannel; // 받은 채널
var pcConstraint; //??뭘까
var bitrateDiv = document.querySelector('div#bitrate'); //비트 비율
var fileInput = document.querySelector('input#fileInput'); //파일인풋
var downloadAnchor = document.querySelector('a#download'); //다운로드 앵커
var sendProgress = document.querySelector('progress#sendProgress'); //보내는바
var receiveProgress = document.querySelector('progress#receiveProgress'); //받는바
var statusMessage = document.querySelector('span#status');//바이트인가??

var receiveBuffer = [];
var receivedSize = 0;

var bytesPrev = 0;
var timestampPrev = 0;
var timestampStart;
var statsInterval = null;
var bitrateMax = 0;

fileInput.addEventListener('change', handleFileInputChange, false);
//파일에 변화가생기면 밑에 있는 파일인풋채인지함수 ㄱㄱㄱ;;
function handleFileInputChange() {
  var file = fileInput.files[0]; //파일을받고 
  if (!file) {
    console.log('No file chosen');
  } else {
	   var arr = Object.keys(userList);
   console.log("feokrofkok",file.name);
		for ( var i = 0; i < arr.length; i++ ){
			if(userList[arr[i]] != userId ){
					send({
						type: "file_request",
						userId: userId,
						receiver: userList[arr[i]],
						filename: file.name,
						size: file.size,
						to: "all"
					});
					 
			}
		}
     //파일이있으면  피어생성..
  }
}

function stringToUint(string) {
    var string = btoa(unescape(encodeURIComponent(string))),
        charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
}

function uintToString(uintArray) {
    var encodedString = String.fromCharCode.apply(null, uintArray),
        decodedString = decodeURIComponent(escape(atob(encodedString)));
    return decodedString;
}



function onCreateSessionDescriptionError(error) {
  //trace('Failed to create session description: ' + error.toString());
}

function sendData(id) {
  var file = fileInput.files[0];
  console.log('File is ' + [file.name, file.size, file.type,
      file.lastModifiedDate
  ].join(' '));

  // Handle 0 size files.
  ////statusMessage.textContent = '';
  downloadAnchor.textContent = '';
  if (file.size === 0) { //닫혀있을떄
   // bitrateDiv.innerHTML = '';
  //  statusMessage.textContent = 'File is empty, please select a non-empty file';
    //closeDataChannels(); 
    return;
  }
//  sendProgress.max = file.size; //파일사이즈만큼
 // receiveProgress.max = file.size; //파일사이즈만큼
  var chunkSize = 16384; //조각 사이즈
  var sliceFile = function(offset) { //0부터 시작  
    var reader = new window.FileReader(); // 파일 리더를 만듬
    reader.onload = (function() {
      return function(e) {
		  var arr = Object.keys(userList);
		  dataChannel[id].send(e.target.result); 
				
			
		
        //sendChannel.send(e.target.result); 
        if (file.size > offset + e.target.result.byteLength) {
          window.setTimeout(sliceFile, 0, offset + chunkSize);
        }
       // sendProgress.value = offset + e.target.result.byteLength;
	}
    })(file); //파일집어넣ㅇ므
    var slice = file.slice(offset, offset + chunkSize);
    reader.readAsArrayBuffer(slice);
  }
  sliceFile(0);
  $chatArea.append('<li class="even">'+ '<a href="'+URL.createObjectURL(file)+'" download="'+file.name+'">'+file.name +'</li>');
}

function closeDataChannels() {
  console.log('Closing data channels');
  sendChannel.close();
  console.log('Closed data channel with label: ' + sendChannel.label);
  if (receiveChannel) {
    receiveChannel.close();
    console.log('Closed data channel with label: ' + receiveChannel.label);
  }
  localConnection.close();
  remoteConnection.close();
  localConnection = null;
  remoteConnection = null;
  //console.log('Closed peer connections');

  // re-enable the file select
  fileInput.disabled = false;
}


function onSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  console.log('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    //sendData();
  }
}

function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  console.log('Receive channel state is: ' + readyState);
  if (readyState === 'open') {
    timestampStart = (new Date()).getTime();
    timestampPrev = timestampStart;
    statsInterval = window.setInterval(displayStats, 500);
    window.setTimeout(displayStats, 100);
    window.setTimeout(displayStats, 300);
  }
}

// display bitrate statistics.
function displayStats() {
  var display = function(bitrate) {
    bitrateDiv.innerHTML = '<strong>Current Bitrate:</strong> ' +
        bitrate + ' kbits/sec';
  };

  if (remoteConnection && remoteConnection.iceConnectionState === 'connected') {
    if (adapter.browserDetails.browser === 'chrome') {
      // TODO: once https://code.google.com/p/webrtc/issues/detail?id=4321
      // lands those stats should be preferrred over the connection stats.
      remoteConnection.getStats(null, function(stats) {
        for (var key in stats) {
          var res = stats[key];
          if (timestampPrev === res.timestamp) {
            return;
          }
          if (res.type === 'googCandidatePair' &&
              res.googActiveConnection === 'true') {
            // calculate current bitrate
            var bytesNow = res.bytesReceived;
            var bitrate = Math.round((bytesNow - bytesPrev) * 8 /
                (res.timestamp - timestampPrev));
            display(bitrate);
            timestampPrev = res.timestamp;
            bytesPrev = bytesNow;
            if (bitrate > bitrateMax) {
              bitrateMax = bitrate;
            }
          }
        }
      });
    } else {
      // Firefox currently does not have data channel stats. See
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1136832
      // Instead, the bitrate is calculated based on the number of
      // bytes received.
      var bytesNow = receivedSize;
      var now = (new Date()).getTime();
      var bitrate = Math.round((bytesNow - bytesPrev) * 8 /
          (now - timestampPrev));
      display(bitrate);
      timestampPrev = now;
      bytesPrev = bytesNow;
      if (bitrate > bitrateMax) {
        bitrateMax = bitrate;
      }
    }
  }
}
});

Object.size = function(obj) {
  var size = 0, key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      size++;
    }
  }
  return size;
};




/*

    <section>
      <form id="fileInfo">
        <input type="file" id="fileInput" name="files"/>
      </form> 

      <div class="progress">
        <div class="label">Send progress: </div>
        <progress id="sendProgress" max="0" value="0"></progress>
      </div>

      <div class="progress">
        <div class="label">Receive progress: </div>
        <progress id="receiveProgress" max="0" value="0"></progress>
      </div>

      <div id="bitrate"></div>
      <a id="download"></a>
      <span id="status"></span>

    </section>
*/

