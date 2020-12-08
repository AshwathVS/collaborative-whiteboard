const x = 0, y = 1;

const queryParams = URI(location.href).query(true);
const roomId = queryParams.roomId;
const name = queryParams.name;
const id = makeid();
var editAccess = false;
var isLeader = false;

const socket = io({path: '/socket.io', query: {roomId: roomId, name: name, id: id}});

var buffer = [];

var isMouseDown = false;

var color, tool, size;

var previewCanvas, drawingCanvas, previewContext, drawingContext;

var persistCRON;

$(document).ready(function() {
    previewCanvas = document.getElementById('preview-canvas');
    drawingCanvas = document.getElementById('drawing-canvas');
    previewContext = previewCanvas.getContext('2d');
    drawingContext = drawingCanvas.getContext('2d');

    previewCanvas.addEventListener("mousedown", function(event) { tool.mouseDown(event);}, false);
    window.addEventListener('mouseup', function(event) {tool.mouseUp(event);}, false);
    window.addEventListener('mousemove', function(event) {tool.mouseMove(event);}, false);

    persistCRON = window.setInterval(persist, 500);

    $('.color').click(function() {
        selectcolor($(this).css('background-color').slice(4, -1).split(','));
    });

    $('.tool').click(function() {
        selectTool($(this).data('tool'));
    });

    $('#size-select').change(function () {
        selectSize($(this).val());
    });

    // defaults
    selectcolor([0,0,0]);
    selectTool('brush');
    selectSize(2);
});

socket.on('draw', function(data) {
    drawing.draw.drawMultiple(drawingContext, data);
});

socket.on('state', function(state) {
    var image = new Image;
    image.onload = function() {
        drawingContext.drawImage(image, 0, 0);
    }
    image.src = state;
});

socket.on('refreshParticipant', function(participants) {
    console.log('refreshParticipant', participants);
    document.getElementById('participants').innerHTML = '';

    participants.sort(function(u1, u2){
        if(u1.name < u2.name) return -1;
        else if(u1.name > u2.name) return 1;
        else return 0;
    });

    for(var i = 0; i < participants.length; i++) {
        var li = document.createElement('li');
        var liName = participants[i].name;
        if(id === participants[i].id) liName = liName + ' (You)';
        li.id = participants[i].id;
        li.innerText = liName;
        document.getElementById('participants').appendChild(li);
    }
});

socket.on('leaderInfo', function(user) {
    console.log('Pick leader called', user.id);
    if(id === user.id) {
        isLeader = true;
        giveEditPermissions();
    }
    else isLeader = false;
    updateLeaderName(user.name);
});

function updateLeaderName(leaderName) {
    document.getElementById('leaderName').innerText = leaderName;
}

function giveEditPermissions() {
    document.getElementById('drawing-canvas').style.pointerEvents = 'all';
    document.getElementById('preview-canvas').style.pointerEvents = 'all';
    editAccess = true;
}

function persist() {
    if(buffer.length > 0) {
        buffer.unshift({cmd: 'color', content: {color: color}});
        buffer.unshift({cmd: 'size', content: {size: size}});
        socket.emit('draw', buffer);
        buffer = [];
    }
}

function selectcolor(c) {
    color = c;
    $('#selected-color').css('background-color', 'rgb(' + color.join(',') + ')');
}

function selectTool(t) {
    $('.tool.selected').removeClass('selected');
    $(".tool[data-tool='"+t+"']").addClass('selected');
    tool = tools[t]; 
}

function selectSize(s) {
    size = s;
}

function getPosition(event) {
    var r = previewCanvas.getBoundingClientRect();
    var x = event.clientX - r.left - document.documentElement.scrollLeft;
    var y = event.clientY - r.top - document.documentElement.scrollTop;
    if(x < 0)
        x = 0;
    if(y < 0)
        y = 0;
    if(x >= r.right)
        x = r.right;
    if(y >= r.bottom)
        y = r.bottom;

    return [x, y];
}

function clearPreview() {
    previewContext.save();
    previewContext.setTransform(1, 0, 0, 1, 0, 0);
    previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewContext.restore();
}

function makeid(length) {
    if(!length) length = 15;
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }

var tools = {
    brush: {
        points: [],
        mouseDown: function (event) {
            isMouseDown = true;
            this.points = [getPosition(event)];
        },
        mouseMove: function (event) {
            if (isMouseDown) {
                if (this.points.length >= 6) {
                    tools.brush.drawCurve(event);
                } else {
                    this.points.push(getPosition(event));
                }
            }
        },
        mouseUp: function (event) {
            isMouseDown = false;
            if (this.points.length) {
                tools.brush.drawCurve(event);
            }
        },
        drawCurve: function () {
            drawingContext.lineWidth = size;
            drawingContext.strokeStyle = 'rgb(' + color.join(',') + ')';
            var startPos = this.points[0];
            var endPos = this.points[this.points.length - 1];
    
            if (this.points.length <= 2) {
                this.points.push(startPos);
                this.points.push(endPos);
            }
    
            var c1 = [0,0];
            for (var i = 1; i < this.points.length - 1; i++) {
                c1[0] += this.points[i][0];
                c1[1] += this.points[i][1];
            }
            c1[0] = c1[0] / (this.points.length - 2);
            c1[1] = c1[1] / (this.points.length - 2);

            var command = {
                cmd: 'curve',
                content: {
                    start: startPos,
                    end: endPos,
                    ctrl: c1
                }
            };
            drawing.draw.draw(drawingContext, command);
            buffer.push(command);
            this.points = [this.points[this.points.length - 1]];
        }
    },
    line: {
        origin: null,
    
        mouseDown: function (event) {
            isMouseDown = true;
            this.origin = getPosition(event);
        },
        mouseMove: function (event) {
            if (isMouseDown) {
                this.drawLine(previewContext, event);
            }
        },
        mouseUp: function (event) {
            isMouseDown = false;
            if (this.origin) {
                buffer.push(this.drawLine(drawingContext, event));
                this.origin = null;
            }
        },
        drawLine: function (ctx, event) {
            clearPreview();
            ctx.lineWidth = size;
            ctx.strokeStyle = 'rgb(' + color.join(',') + ')';

            var startPos = [this.origin[x], this.origin[y]];
            var endPos = getPosition(event);

            const command = {
                cmd: 'line',
                content: {
                    start: startPos,
                    end: endPos
                }
            }
            drawing.draw.draw(ctx, command);
            return command;
        }
    },
    quad: {
        origin: null,
        fill: false,
        mouseDown: function (event) {
            isMouseDown = true;
            this.origin = getPosition(event);
        },
        mouseMove: function (event) {
            if (isMouseDown) {
                this.drawBox(previewContext, event);
            }
        },
        mouseUp: function (event) {
            isMouseDown = false;
            if (this.origin) {
                buffer.push(this.drawBox(drawingContext, event));
                this.origin = null;
            }
        },
        drawBox: function (ctx, event) {
            clearPreview();
            ctx.lineWidth = size;
            ctx.strokeStyle = 'rgb(' + color.join(',') + ')';
            ctx.fillStyle = 'rgb(' + color.join(',') + ')';

            var v1 = [this.origin[x], this.origin[y]];
            var v3 = getPosition(event);    
            var v2 = [v1[x], v3[y]],
                v4 = [v3[x], v1[y]];

            const command = {
                cmd: 'box',
                content: {
                    v1: v1,
                    v2: v2,
                    v3: v3,
                    v4: v4,
                    fill: this.fill
                }
            }

            drawing.draw.draw(ctx, command);
    
            return command;
        }
    }
}

tools.fillQuad = { fill: true };
tools.fillQuad.__proto__ = tools.quad;


function requestEditAccess() {
    if(editAccess) return;
    else {
        console.log('requesting edit access');
        socket.emit('c2l', {roomId: roomId, eventType: "EDIT_ACCESS_REQUEST", content: {userId: id, socketId: socket.id, userName: name}});
    }
}

function saveBlackboard() {
    socket.emit('initSaveBlackboardVoting', roomId);
}

socket.on('EDIT_ACCESS_REQUEST', function(data) {
    var accessResponse = confirm('Allow edit access for ' + data.userName + '?');
    socket.emit('c2c', {socketId: data.socketId, eventType: 'EDIT_ACCESS_RESPONSE', content: accessResponse});
});

socket.on('EDIT_ACCESS_RESPONSE', function(response) {
    console.log('Edit access response', response);
    if(response) {
        giveEditPermissions();
    } else {
        alert('Edit access has been rejected');
    }
});

/*
  {
      voteType: "", // PERSIST_STATE, LEADER_SELECT
      voteId: "",
      createdAt: "",
      content: {
          
      }
  }
  const eventData = {voteType: "LEADER_SELECT", id: voteDetail.id, content: { confirmMessage: 'Do you want to choose ' + randomUser.name + ' to be the leader?'}, createdAt: Date.now()};
 */
socket.on('TO_VOTE', function(data) {
    const vote = confirm(data.content.confirmMessage);
    socket.emit('ON_VOTE', {id: data.id, result: vote});
});


