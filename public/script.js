const video = document.getElementById('video');

Promise.all([
	faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
	faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
	faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
	faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
]).then(getUsers);

getUsers();
var labels = [];
function getUsers() {
    bindAlreadyAttendantUsers();
	var xhr = new XMLHttpRequest();
	xhr.open('GET', '/api/getUsers', true);
	xhr.setRequestHeader('Content-Type', 'application/json');

	xhr.onreadystatechange = function () {
		if (xhr.readyState === 4) { // 4 means the request is done
			if (xhr.status === 200) {
				var data = JSON.parse(xhr.responseText);

				if (data.message === 'success' && data.users.length) {
					labels = data.users.map((item) => item.image_path.split('/')[2]);
					startVideo();
				}else{
					window.open('/register.html', '_blank');
				}
			} else {
				console.error('Error in AJAX request:', xhr.statusText);
			}
		}
	};

	xhr.send();
}

function bindAlreadyAttendantUsers(){
    $("#list tbody").html('');
    if(localStorage.getItem('attendeeList')!=null){
        let attendeeList = JSON.parse(localStorage.getItem('attendeeList'));
        attendeeList.users.forEach(function(item, index){
            $("#list tbody").append('<tr><td>' + (index + 1) + '</td><td>' + item.name + '</td><td>' + item.time + '</td></tr>')
        });
    }    
}
function startVideo() {
	navigator.mediaDevices.getUserMedia({ video: {} })
		.then(stream => video.srcObject = stream)
		.catch(err => console.error('Error:', err));
}

// Dummy descriptors (add real registration logic in production)
const loadLabeledImages = async () => {
	// Replace with real names
	if (labels.length) {
		return Promise.all(
			labels.map(async label => {
				const img = await faceapi.fetchImage(`/images/${label}`);
				const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

				console.log(detections)
				// Check if a face was detected
				if (!detections) {
					console.error(`No face detected in image for label: ${label}`);
					return null; // Return null if no face was detected
				}

				return new faceapi.LabeledFaceDescriptors(label, [detections.descriptor]);
			})
		).then(results => results.filter(result => result !== null)); // Filter out null values
	}
};


video.addEventListener('play', async () => {
	const canvas = faceapi.createCanvasFromMedia(video);
	document.body.append(canvas);

	const displaySize = { width: video.width, height: video.height };
	faceapi.matchDimensions(canvas, displaySize);

	const labeledDescriptors = await loadLabeledImages();
	console.log("Labeled Descriptors:", labeledDescriptors);
	const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

	setInterval(async () => {
		const detections = await faceapi.detectAllFaces(video)
			.withFaceLandmarks()
			.withFaceDescriptors();

		if (detections && detections.length > 0) {
			const resizedDetections = faceapi.resizeResults(detections, displaySize);
			canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

			resizedDetections.forEach(async (detection) => {
				if (detection.descriptor) {
					const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
					if (bestMatch.label !== 'unknown') {
						let verifiedUserName = bestMatch.label.split("-")[1].split(".")[0];
						$('video').css("border","5px solid green");
						$("#status").html(`${verifiedUserName} Verified`);

						setTimeout(function(){
							$('video').css("border","none");
							$("#status").html(``);
						},2000);

                        //localstorage is using for checking todays attendees
						let attendeeList = localStorage.getItem('attendeeList');
						if(attendeeList==null){
							attendeeList = {
								users:[],
								date:new Date()
							};
						}else{ 
							attendeeList = JSON.parse(localStorage.getItem('attendeeList'))
							if(attendeeList.date<new Date()){
								attendeeList = {
									users:[],
									date:new Date()
								};
							}
						}
                        let todaysAttendList = attendeeList.users.map((item)=>item.name)
						if (!todaysAttendList.includes(bestMatch.label)) {
							attendeeList.users.push({
                                name:bestMatch.label,
                                time:new Date().toDateString()+" "+new Date().toTimeString()
                            });
							localStorage.setItem('attendeeList', JSON.stringify(attendeeList)); 

							let length = $("#list tbody tr").length;
							$("#list tbody").append('<tr><td>' + (length + 1) + '</td><td>' + verifiedUserName + '</td><td>' + (new Date().toDateString()+" "+new Date().toTimeString()) + '</td></tr>');
							// Send attendance to server
							await fetch('/api/attendance', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ name: verifiedUserName })
							});
						}
					}
				}
			});
		} else {
			$('video').css("border","5px solid red");
			$("#status").html(`Unknown Person`);
			setTimeout(function(){
				$('video').css("border","none");
				$("#status").html(``);
			},2000);
		}
	}, 3000);
});
