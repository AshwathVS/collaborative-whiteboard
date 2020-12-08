function submit() {
    const roomId = document.getElementById('txtRoomId').value;
    const name = document.getElementById('txtName').value;

    if(validate(roomId, name)) {
        window.location.href = window.location.href + 'client?roomId=' + roomId + '&name=' + name;// + '&isNew=' + isNew;
    }
}

function validate(roomId, name) {
    var isValid = roomId && name;

    if(!roomId) document.getElementById('roomError').hidden = false;
    else document.getElementById('roomError').hidden = true;

    if(!name) document.getElementById('nameError').hidden = false;
    else document.getElementById('nameError').hidden = true;

    return isValid;
}
