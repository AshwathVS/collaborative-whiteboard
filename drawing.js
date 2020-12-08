(function(exports) {

    const x = 0;
    const y = 1;

    const commands = {
        line: function(ctx, data) {
            const start = data.start;
            const end = data.end;
            ctx.beginPath();
            ctx.moveTo(start[x], start[y]);
            ctx.lineTo(end[x], end[y]);
            ctx.stroke();
        },
        curve: function(ctx, data) {
            const start = data.start;
            const end = data.end;
            const ctrl = data.ctrl;
            ctx.beginPath();
            ctx.moveTo(start[x], start[y])
            ctx.quadraticCurveTo(ctrl[x], ctrl[y], end[x], end[y]);
            ctx.stroke();
        },
        box: function(ctx, data) {
            const v1 = data.v1;
            const v2 = data.v2;
            const v3 = data.v3;
            const v4 = data.v4;
            const fill = data.fill;

            ctx.beginPath();
            ctx.moveTo(v1[x], v1[y]);
            
            ctx.lineTo(v2[x], v2[y]);
            ctx.lineTo(v3[x], v3[y]);
            ctx.lineTo(v4[x], v4[y]);
            ctx.lineTo(v1[x], v1[y]);
            
            if(fill) ctx.fill();
            else ctx.stroke();
        },
        color: function(ctx, data) {
            const color = data.color;
            ctx.strokeStyle = "rgb(" + color.join(',') + ")";
            ctx.fillStyle = "rgb(" + color.join(',') + ")";
        },
        size: function(ctx, data) {
            ctx.lineWidth = data.size;
        }
    };


    function drawCommands(context, data) {
        for(var i=0; i<data.length; i++) {
            drawCommand(context, data[i]);
        }
    }

    function drawCommand(context, data) {
        commands[data.cmd](context, data.content);
    }

    exports.draw = {
        draw: drawCommand,
        drawMultiple: drawCommands
    }
    
})(typeof exports === 'undefined'? this['drawing']={}: exports);