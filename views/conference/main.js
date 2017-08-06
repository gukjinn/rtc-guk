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
  var remoteUserId = null;
  var isOffer = null;
  var localStream = null;
 // var peer ; 
  var peerConnections ={};  // offer or answer peer
  var userList = {};
  var dataChannel = {};
  var count = 0;
  var count2 = 98;

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
  var $remoteWrap = $('#remote-wrap');
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
			console.log("isOffer 요쪽이 여기가 문제인가??");
			var arr = Object.keys(userList);
			console.log("우리의 유저리스트",userList);
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
	
    peer.addStream(localStream); 
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
     var arr= Object.keys(userList);
     if((count%2)==0){
       count2++;
      $remoteWrap.append('<div id="'+String.fromCharCode(count2)+'" class="row"> </div>');
     }
     // var temp = count%2;
     $('#'+String.fromCharCode(count2)).append('<div id="'+"remote"+count+'"class="col-md-6" border:1px solid black> <video class="remote-video" autoplay="true" src="'+URL.createObjectURL(event.stream)+'"></video></div>');
     count++;
     
     


//  $remoteWrap.append('<div id= "'+userList[arr[count++]]+'"> <video id="remote-video" autoplay="true" src="' + URL.createObjectURL(event.stream) + '"></video></div>');

    };

    pc.onremovestream = function(event) {
      console.log("Removing remote stream", event);
    };
	pc.ondatachannel = function(event) {
		  var receiveChannel = event.channel;
		  receiveChannel.onmessage = function(event) {
			  console.log("ondatachannel message:", event.data);
			  $chatArea.append('<li class="odd">'+ event.data + '</li>'); 
 			var obj = document.getElementById("chatt");
			obj.scrollTop = obj.scrollHeight;
			};     
		}; 
		
      //creating data channel 
      dataChannel[id] = pc.createDataChannel("channel1", {reliable:true}); 
		
      dataChannel[id].onerror = function (error) { 
         console.log("Ooops...error:", error); 
      }; 
		
      //when we receive a message from the other peer, display it on the screen 
      pc.onmessage = function (event) { 
         
      }; 
		
      pc.onclose = function () { 
         console.log("data channel is closed"); 
      };
	
	
  
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
    if (!remoteUserId) {
      remoteUserId = data.userId; //원격유저아이디
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
    } else {
      //console.log()
    }
  }

  /**
   * setRoomToken
   */
  function setRoomToken() {
    

    if (location.hash.length > 2) {
      $uniqueToken.attr('href', location.href);
    } else {
	
		location.hash = '#' + (Math.random() * new Date().getTime()).toString(32).toUpperCase().replace(/\./g, '-');
		
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
      '<div class="room-info"style="margin:auto" ><p>당신을 기다리고 있어요</p><input type = "text" id = "userInput2" class ="form-control" placeholder ="User Name" style="width:20%"required="" autofocus = ""><span class="input-group-bgn"><button class="btn btn-default type="button" id="join">Join</button></span></div>'].join('\n'));
    var $btnJoin = $('#join');
    $btnJoin.click(function() {
      isOffer = true;
	  console.log("시발여기가 문제인가???????");
	  var tt = $('#userInput2').val();
	  if(!tt){
		alert('이름을 입력해주세요.');
		return;

	}
	 
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
    if (remoteUserId == userId) {
      $('#remote-video').remove();
      $body.removeClass('connected').addClass('wait');
      remoteUserId = null;
    }
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
	  console.log("핸쉬길이",location.hash.length);
	 if(location.hash.length > 2){
		 var tt = '';		 
		 setRoomToken();
		 setClipboard();
		 roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
		 onFoundUser(); 
		
  
	}
    $(document).ready(function() {
		
		var tt2 = $('#user').text();
		if(tt2 == ' ')
			return;
		
			setRoomToken(); 
			setClipboard(); 
			
			roomId = location.href.replace(/\/|:|#|%|\.|\[|\]/g, '');
			
			userId = tt2;
			socket.emit('joinRoom', roomId, userId);
			if(userList)
				getUserMedia();
    });

    $('#btn-camera').click(function() {
      var $this = $(this);
      $this.toggleClass('active');

      if ($this.hasClass('active')) {
        pauseVideo();
      } else {
        resumeVideo();
      }
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

		var arr = Object.keys(userList);
		for ( var i = 0; i < arr.length; i++ ){
			if(dataChannel[userList[arr[i]]] != null)
			dataChannel[userList[arr[i]]].send(userId +': '+ val); 
			
		}
                        var obj = document.getElementById("chatt");
                        obj.scrollTop = obj.scrollHeight;

		msgInput.value = ""; 
	});
  }
  initialize();

  /**
   * socket handling
   */
 // socket.emit('joinRoom', roomId, userId);
  socket.on('joinRoom', function(roomId, thisRoom) {
    console.log('joinRoom', arguments);
	userList = thisRoom;
		console.log("뭔지알아야",roomId);
	
	console.log("우리의 룸",thisRoom);
	console.log("유저 리스트 뽑는다.", userList);
	
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
