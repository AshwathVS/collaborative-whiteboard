var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Canvas = require('canvas');
var drawing = require('./drawing');
var uuid = require('uuid');

var port = parseInt(process.argv[2] || '3000');

const onGoingLeaderVoteDetails = {};

const onGoingPersistStateDetails = {};

const voteResultsStore = {};

const rooms = {

};

const socketToRoomMapping = {

};

const usersInRoom = {

};

const roomToLeader = {

};

app.get('/', function(req, res) {
    res.sendFile('index.html', { root: __dirname });
});

app.get('/client', function(req, res) {
    res.sendFile('client.html', { root: __dirname });
});

app.get('/drawing.js', function(req, res) {
    res.sendFile('drawing.js', { root: __dirname });
});

app.get('/index.js', function(req, res) {
    res.sendFile('index.js', { root: __dirname });
});

app.get('/client.js', function(req, res) {
    res.sendFile('client.js', { root: __dirname });
});

app.get('/client.css', function(req, res) {
    res.sendFile('client.css', { root: __dirname });
});

const removeUserFromRoom = (roomId, id) => {
    var users = usersInRoom[roomId];
    if(users) {
        var index = -1;
        for(var i=0; i<users.length; i++) {
            if(users[i].id === id) {
                index = i;
                break;
            }
        }

        if(index != -1) {
            usersInRoom[roomId].splice(index, 1);
        }
    }
};

const checkForOngoingLeaderSelection = (roomId) => {
    if(onGoingLeaderVoteDetails[roomId]) {
        if((Date.now() - onGoingLeaderVoteDetails[roomId].createdAt) / 1000 < 30) return true;
    }
    return false;
};

const initLeaderSelection = (roomId) => {
    const isOngoingLeaderSelection = checkForOngoingLeaderSelection(roomId);
    const length = usersInRoom[roomId].length;
    if(length == 0) return;
    else if(length === 1) {
        roomToLeader[roomId] = usersInRoom[roomId][0];
        io.to(roomId).emit('leaderInfo', {id: roomToLeader[roomId].id, name: roomToLeader[roomId].name});
    } else {
        if(!isOngoingLeaderSelection) {
            const randomUser = usersInRoom[roomId][Math.floor(Math.random() * 500) % length];

            const voteDetail = {id: uuid.v1(), selectedUser: randomUser, createdAt: Date.now(), roomId: roomId};
            onGoingLeaderVoteDetails[roomId] = voteDetail;
    
            const eventData = {voteType: "LEADER_SELECT", id: voteDetail.id, content: { confirmMessage: 'Do you want to choose ' + randomUser.name + ' to be the leader?'}, createdAt: Date.now()};
    
            voteResultsStore[voteDetail.id] = { total: usersInRoom[roomId].length, positive: 0, roomId: roomId, negative: 0, type: 'LEADER_SELECT'};
    
            io.to(roomId).emit('TO_VOTE', eventData);
        }
    }
}

const onLeaderVoteSuccess = (roomId) => {
    // emit and save leader!
    console.log('leader vote success', roomId);
    roomToLeader[roomId] = onGoingLeaderVoteDetails[roomId].selectedUser;
    io.to(roomId).emit('leaderInfo', {id: roomToLeader[roomId].id, name: roomToLeader[roomId].name});
} 

const clearLeaderSelectVoteDetails = (roomId) => {
    delete voteResultsStore[onGoingLeaderVoteDetails[roomId].id];
    delete onGoingLeaderVoteDetails[roomId];
}

const clearSaveBoardVoteDetails = (roomId) => {
    delete voteResultsStore[onGoingPersistStateDetails[roomId].id];
    delete onGoingPersistStateDetails[roomId];
}

const onPersistVoteSuccess = (roomId) => {
    rooms[roomId].sourceContext.drawImage(rooms[roomId].canvas, 0, 0);
}

io.on('connection', function(socket) {
    console.log('Connection opened with id: ' + socket.id);
    const roomId = socket.handshake.query.roomId;
    const name = socket.handshake.query.name;
    const socketId = socket.id;
    const id = socket.handshake.query.id;

    const user = {id: id, name: name, socketId: socketId};

    socketToRoomMapping[socketId] = roomId;

    if(!rooms[roomId]) {
        var canvas = new Canvas(1024, 600);
        var context = canvas.getContext('2d');
        var sourceCanvas = new Canvas(2024, 600);
        var sourceContext = sourceCanvas.getContext('2d');

        context.strokeStyle = "rgb(0, 0, 0)";
        context.lineCap = 'round';

        sourceContext.strokeStyle = "rgb(0, 0, 0)";
        sourceContext.lineCap = 'round';
        
        var newRoom = {
            canvas: canvas,
            context: context,
            sourceCanvas: sourceCanvas,
            sourceContext: sourceContext
        }

        rooms[roomId] = newRoom;
    }

    socket.join(roomId);

    if(!usersInRoom[roomId]) {
        usersInRoom[roomId] = [];
    }

    if(!roomToLeader[roomId]) {
        roomToLeader[roomId] = user;
        console.log('Leader Info', roomToLeader);
        io.to(roomId).emit('leaderInfo', {id: user.id, name: user.name});
    } else {
        io.to(roomId).emit('leaderInfo', {id: roomToLeader[roomId].id, name: roomToLeader[roomId].name});
    }

    usersInRoom[roomId].push(user);

    io.to(roomId).emit('refreshParticipant', usersInRoom[roomId]);

    // On disconnect
    socket.on('disconnect', (data) => {
        console.log('disconnect', socketToRoomMapping);
        removeUserFromRoom(roomId, id);
        delete socketToRoomMapping[socketId];

        if(roomToLeader[roomId] && roomToLeader[roomId].id === id) {
            delete roomToLeader[roomId];
            initLeaderSelection(roomId);
        }

        io.to(roomId).emit('refreshParticipant', usersInRoom[roomId]);
    });

    io.to(roomId).emit('state', rooms[roomId].canvas.toDataURL());

    socket.on('draw', function(data) {
        drawing.draw.drawMultiple(rooms[roomId].context, data);
        io.to(roomId).emit('draw', data);
    });

    /*
        {
            roomId: "",
            eventType: "", // EDIT_ACCESS_REQUEST
            content: {}
        }
    */
    socket.on('c2l', function(data) {
        console.log('c2l invoked', data);
        if(roomToLeader[data.roomId]) {
            socket.to(roomToLeader[data.roomId].socketId).emit(data.eventType, data.content);
        }
    });

    /*
        {
            socketId: "",
            eventType: "", // EDIT_ACCESS_RESPONSE, 
            content: {}
        }
    */
    socket.on('c2c', function(data) {
        console.log('c2c invoked', data);
        socket.to(data.socketId).emit(data.eventType, data.content);
    });

    socket.on('initSaveBlackboardVoting', function(roomId) {
        const ongoingVotePresent = checkForOngoingSaveBlackboardProcess(roomId);
        if(!ongoingVotePresent) {
            const id = uuid.v1();
            const data = {roomId: roomId, createdAt: Date.now(), id: id};
            onGoingPersistStateDetails[roomId] = data;
            voteResultsStore[id] = {roomId: roomId, type: 'SAVE_BOARD', positive: 0, negative: 0, total: usersInRoom[roomId].length};
            io.to(roomId).emit('TO_VOTE', {id: id, content: {confirmMessage: 'Do you wish to persist the current state of the board?'}});
        }
    });

    function checkForOngoingSaveBlackboardProcess(roomId) {
        return onGoingPersistStateDetails[roomId] && ((Date.now() - onGoingPersistStateDetails[roomId].createdAt)/1000) < 15;
    }

    /*
        {
            id: "",
            result: boolean,
            roomId: roomId
        }
    */
    socket.on('ON_VOTE', function(data) {
        const voteId = data.id;
        if(voteResultsStore[voteId]) {
            if(data.result) {
                voteResultsStore[voteId].positive++;
            } else {
                voteResultsStore[voteId].negative++;
            }
            checkForMajority(voteId);
        }
    });
});

const checkForMajority = (voteId) => {
    const roomId = voteResultsStore[voteId].roomId;
    const type = voteResultsStore[voteId].type;
    if(voteResultsStore[voteId].positive >= voteResultsStore[voteId].total/2) {
        postVoteWin(roomId, type);
    } else if(voteResultsStore[voteId].negative >= voteResultsStore[voteId].total/2) {
        postVoteLoss(roomId, type);
    }
};

const postVoteWin = (roomId, type) => {
    if(type === 'LEADER_SELECT') {
        onLeaderVoteSuccess(roomId);
        clearLeaderSelectVoteDetails(roomId);
    } else if(type === 'SAVE_BOARD') {
        onPersistVoteSuccess(roomId);
        clearSaveBoardVoteDetails(roomId);
    }
};

const postVoteLoss = (roomId, type) => {
    if(type === 'LEADER_SELECT') {
        clearLeaderSelectVoteDetails(roomId);
        initLeaderSelection(roomId);
    } else if(type === 'SAVE_BOARD') {
        clearSaveBoardVoteDetails(roomId);
    }
}

http.listen(port, function() {
    console.log('Listening on ' + port);
});
