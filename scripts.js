// Global variables for YouTube API readiness and player instances
let youtubeApiReady = false;
let youtubePlayer = null;
let youtubeTimeUpdateInterval = null;

// YouTube Data API key (replace with your own API key)
const YOUTUBE_API_KEY = 'put_yer_own_key'; // Replace with your actual YouTube Data API key

// This function is called by the YouTube IFrame Player API when it's ready.
window.onYouTubeIframeAPIReady = function() {
    youtubeApiReady = true;
    console.log('YouTube IFrame API is ready.');
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded. Initializing player...');

    // 1. Global variables for DOM elements
    const featuredVideoDiv = document.getElementById('featuredVideo');
    const videoUrlInput = document.getElementById('videoUrl');
    const loadVideoButton = document.getElementById('loadVideoButton');
    const searchQueryInput = document.getElementById('searchQuery');
    const searchButton = document.getElementById('searchButton');
    const searchResultsDiv = document.getElementById('searchResults');
    const errorMessageDiv = document.getElementById('errorMessage');
    const videoPlayerContainer = document.getElementById('videoPlayerContainer');
    const videoContentWrapper = document.getElementById('videoContentWrapper');
    const customControls = document.getElementById('customControls');
    const playPauseButton = document.getElementById('playPauseButton');
    const seekSlider = document.getElementById('seekSlider');
    const currentTimeSpan = document.getElementById('currentTime');
    const durationSpan = document.getElementById('duration');
    const volumeSlider = document.getElementById('volumeSlider');
    const toggleFullscreenButton = document.getElementById('toggleFullscreenButton');
    const volumeIcon = document.getElementById('volumeIcon');
    const seekControlsGroup = document.getElementById('seekControlsGroup');

    console.log('DOM elements fetched:', {
        featuredVideoDiv, videoUrlInput, loadVideoButton, searchQueryInput, searchButton,
        searchResultsDiv, errorMessageDiv, videoPlayerContainer, videoContentWrapper,
        customControls, playPauseButton, seekSlider, currentTimeSpan, durationSpan,
        volumeSlider, toggleFullscreenButton, volumeIcon, seekControlsGroup
    });

    // 2. State variables
    let currentVideoType = 'none';
    let currentVideoElement = null;
    let isSeeking = false;

    // 3. Utility Functions

    function showErrorMessage(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.classList.remove('hidden');
    }

    function hideErrorMessage() {
        errorMessageDiv.classList.add('hidden');
        errorMessageDiv.textContent = '';
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function getYouTubeVideoId(url) {
        let videoId = null;
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/i;
        const match = url.match(youtubeRegex);
        if (match && match[1]) {
            videoId = match[1];
        }
        return videoId;
    }

    function removeDirectVideoListeners() {
        if (currentVideoElement) {
            currentVideoElement.removeEventListener('play', updatePlayPauseButton);
            currentVideoElement.removeEventListener('pause', updatePlayPauseButton);
            currentVideoElement.removeEventListener('timeupdate', updateProgressBar);
            currentVideoElement.removeEventListener('loadedmetadata', setDuration);
            currentVideoElement.removeEventListener('volumechange', updateVolumeSlider);
            currentVideoElement.removeEventListener('error', handleDirectVideoError);
            currentVideoElement = null;
        }
    }

    function destroyYouTubePlayer() {
        if (youtubePlayer) {
            youtubePlayer.destroy();
            youtubePlayer = null;
        }
        if (youtubeTimeUpdateInterval) {
            clearInterval(youtubeTimeUpdateInterval);
            youtubeTimeUpdateInterval = null;
        }
    }

    // 4. YouTube IFrame Player API event handlers

    function onYouTubePlayerReady(event) {
        console.log('YouTube Player is ready. Player object:', event.target);
        event.target.setVolume(volumeSlider.value * 100);
        updateVolumeSlider();
        setDuration();
        if (event.target.getPlayerState() !== YT.PlayerState.PLAYING) {
            event.target.playVideo();
            console.log('Attempting to play YouTube video on ready.');
        }
        updatePlayPauseButton();
        youtubeTimeUpdateInterval = setInterval(() => {
            if (youtubePlayer && youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING && !isSeeking) {
                updateProgressBar();
            }
        }, 1000);
    }

    function onYouTubePlayerStateChange(event) {
        console.log('YouTube Player state changed:', event.data);
        if (event.data === YT.PlayerState.PLAYING) {
            updatePlayPauseButton();
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
            updatePlayPauseButton();
        } else if (event.data === YT.PlayerState.BUFFERING || event.data === YT.PlayerState.CUED) {
            playPauseButton.textContent = '▶';
        }
        setDuration();
    }

    function onYouTubePlayerError(event) {
        console.error('YouTube Player error:', event.data);
        let errorMessageText = 'Error playing YouTube video. It might be unavailable or restricted.';
        switch(event.data) {
            case 2:
                errorMessageText = 'Invalid YouTube video ID or video not found.';
                break;
            case 100:
                errorMessageText = 'YouTube video not found or private.';
                break;
            case 101:
            case 150:
                errorMessageText = 'YouTube video cannot be played in an embedded player (e.g., copyright restrictions).';
                break;
        }
        showErrorMessage(errorMessageText + ' (Code: ' + event.data + ').');
        videoContentWrapper.innerHTML = '';
        videoPlayerContainer.classList.add('hidden');
        customControls.classList.add('hidden');
        destroyYouTubePlayer();
    }

    // 5. Custom Controls Logic

    function togglePlayPause() {
        console.log('Toggle Play/Pause clicked. currentVideoType:', currentVideoType);
        if (currentVideoType === 'direct' && currentVideoElement) {
            if (currentVideoElement.paused || currentVideoElement.ended) {
                currentVideoElement.play();
                console.log('Playing direct video');
            } else {
                currentVideoElement.pause();
                console.log('Pausing direct video');
            }
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            const playerState = youtubePlayer.getPlayerState();
            if (playerState === YT.PlayerState.PLAYING) {
                youtubePlayer.pauseVideo();
                console.log('Pausing YouTube video');
            } else {
                youtubePlayer.playVideo();
                console.log('Playing YouTube video');
            }
        } else {
            showErrorMessage('No video loaded or player not ready.');
        }
    }

    function updatePlayPauseButton() {
        if (currentVideoType === 'direct' && currentVideoElement) {
            playPauseButton.textContent = currentVideoElement.paused ? '▶' : '⏸';
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            const playerState = youtubePlayer.getPlayerState();
            playPauseButton.textContent = (playerState === YT.PlayerState.PLAYING) ? '⏸' : '▶';
        }
    }

    function updateProgressBar() {
        let currentTime = 0;
        let duration = 0;

        if (currentVideoType === 'direct' && currentVideoElement) {
            currentTime = currentVideoElement.currentTime;
            duration = currentVideoElement.duration;
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            currentTime = youtubePlayer.getCurrentTime();
            duration = youtubePlayer.getDuration();
        }

        if (!isNaN(duration) && duration > 0) {
            seekSlider.value = currentTime;
            seekSlider.style.setProperty('--progress-fill', `${(currentTime / duration) * 100}%`);
            currentTimeSpan.textContent = formatTime(currentTime);
        } else {
            seekSlider.value = 0;
            seekSlider.style.setProperty('--progress-fill', '0%');
            currentTimeSpan.textContent = '00:00';
        }
    }

    function setDuration() {
        let duration = 0;
        if (currentVideoType === 'direct' && currentVideoElement) {
            duration = currentVideoElement.duration;
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            duration = youtubePlayer.getDuration();
        }

        if (!isNaN(duration) && duration > 0) {
            seekSlider.max = duration;
            durationSpan.textContent = formatTime(duration);
        } else {
            seekSlider.max = 0;
            durationSpan.textContent = '00:00';
        }
    }

    function handleSeekSliderInput() {
        const newTime = seekSlider.value;
        console.log(`Seek slider input: newTime = ${newTime}`);
        if (currentVideoType === 'direct' && currentVideoElement) {
            currentVideoElement.currentTime = newTime;
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            youtubePlayer.seekTo(newTime, true);
        }
        updateProgressBar();
    }

    function changeVolume() {
        const volume = volumeSlider.value;
        if (currentVideoType === 'direct' && currentVideoElement) {
            currentVideoElement.volume = volume;
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            youtubePlayer.setVolume(volume * 100);
        }
    }

    function updateVolumeSlider() {
        let volume = 1;
        if (currentVideoType === 'direct' && currentVideoElement) {
            volume = currentVideoElement.volume;
        } else if (currentVideoType === 'youtube' && youtubePlayer) {
            volume = youtubePlayer.getVolume() / 100;
        }
        volumeSlider.value = volume;
    }

    function handleDirectVideoError() {
        showErrorMessage('Failed to load direct video. Please check the URL and ensure it\'s a direct link to a video file.');
        videoContentWrapper.innerHTML = '';
        videoPlayerContainer.classList.add('hidden');
        customControls.classList.add('hidden');
        removeDirectVideoListeners();
    }

    function toggleFullscreen() {
        console.log('toggleFullscreen called. currentVideoType:', currentVideoType);
        let elementToFullscreen = null;

        if (currentVideoType === 'direct' && currentVideoElement) {
            elementToFullscreen = videoPlayerContainer;
        } else if (currentVideoType === 'youtube' && videoContentWrapper.querySelector('div')) {
            elementToFullscreen = videoPlayerContainer;
        } else {
            showErrorMessage('Please load a video first to use fullscreen.');
            return;
        }

        if (elementToFullscreen) {
            if (!document.fullscreenElement) {
                elementToFullscreen.requestFullscreen().catch(err => {
                    console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
                    showErrorMessage('Failed to go fullscreen. Your browser might restrict it or the video is not ready.');
                });
            } else {
                document.exitFullscreen();
            }
        }
    }

    // 6. YouTube Homepage and Search Functionality

    async function fetchFeaturedVideo() {
        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&maxResults=2&regionCode=US&key=${YOUTUBE_API_KEY}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Featured video data:', data);

            if (data.items && data.items.length > 1) {
                // Select the second most trending video (index 1)
                const item = data.items[1];
                const videoId = item.id;
                const title = item.snippet.title;
                const thumbnail = item.snippet.thumbnails.high.url;

                featuredVideoDiv.innerHTML = `
                    <img src="${thumbnail}" alt="${title}" loading="lazy">
                    <div class="overlay">
                        <p class="text-lg font-semibold">${title}</p>
                        <button>Play Now</button>
                    </div>
                `;
                featuredVideoDiv.querySelector('button').addEventListener('click', () => {
                    videoUrlInput.value = `https://www.youtube.com/watch?v=${videoId}`;
                    loadVideo();
                    searchResultsDiv.style.display = 'none';
                    searchResultsDiv.innerHTML = '';
                });
            } else if (data.items && data.items.length === 1) {
                // Fallback to first video if only one is available
                const item = data.items[0];
                const videoId = item.id;
                const title = item.snippet.title;
                const thumbnail = item.snippet.thumbnails.high.url;

                featuredVideoDiv.innerHTML = `
                    <img src="${thumbnail}" alt="${title}" loading="lazy">
                    <div class="overlay">
                        <p class="text-lg font-semibold">${title}</p>
                        <button>Play Now</button>
                    </div>
                `;
                featuredVideoDiv.querySelector('button').addEventListener('click', () => {
                    videoUrlInput.value = `https://www.youtube.com/watch?v=${videoId}`;
                    loadVideo();
                    searchResultsDiv.style.display = 'none';
                    searchResultsDiv.innerHTML = '';
                });
                console.warn('Only one trending video available; falling back to first video.');
            } else {
                featuredVideoDiv.innerHTML = '<p class="text-purple-100">No featured video available.</p>';
            }
        } catch (error) {
            console.error('Error fetching featured video:', error);
            featuredVideoDiv.innerHTML = '<p class="text-red-400">Failed to load featured video. Please check your API key or try again later.</p>';
        }
    }

    async function searchYouTube() {
        const query = searchQueryInput.value.trim();
        if (!query) {
            showErrorMessage('Please enter a search term.');
            searchResultsDiv.style.display = 'none';
            return;
        }

        hideErrorMessage();
        searchResultsDiv.innerHTML = '';

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`
            );
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            console.log('YouTube search results:', data);

            if (data.items && data.items.length > 0) {
                searchResultsDiv.style.display = 'grid';
                data.items.forEach(item => {
                    const videoId = item.id.videoId;
                    const title = item.snippet.title;
                    const thumbnail = item.snippet.thumbnails.medium.url;

                    const resultItem = document.createElement('div');
                    resultItem.className = 'search-result-item';
                    resultItem.innerHTML = `
                        <img src="${thumbnail}" alt="${title}" loading="lazy">
                        <p>${title}</p>
                    `;
                    resultItem.addEventListener('click', () => {
                        videoUrlInput.value = `https://www.youtube.com/watch?v=${videoId}`;
                        loadVideo();
                        searchResultsDiv.style.display = 'none';
                        searchResultsDiv.innerHTML = '';
                    });
                    searchResultsDiv.appendChild(resultItem);
                });
            } else {
                showErrorMessage('No videos found for your search.');
                searchResultsDiv.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching YouTube:', error);
            showErrorMessage('Failed to search YouTube. Please check your API key or try again later.');
            searchResultsDiv.style.display = 'none';
        }
    }

    // 7. Main Video Loading Logic

    function loadVideo() {
        console.log('loadVideo function called.');
        hideErrorMessage();
        videoContentWrapper.innerHTML = '';
        videoPlayerContainer.classList.add('hidden');
        removeDirectVideoListeners();
        destroyYouTubePlayer();
        currentVideoType = 'none';
        searchResultsDiv.style.display = 'none';
        searchResultsDiv.innerHTML = '';

        const url = videoUrlInput.value.trim();

        if (!url) {
            showErrorMessage('Please enter a video URL.');
            return;
        }

        const youtubeId = getYouTubeVideoId(url);

        if (youtubeId) {
            currentVideoType = 'youtube';
            const playerDivId = 'youtube-player-div';
            const iframeWrapper = document.createElement('div');
            iframeWrapper.className = 'relative w-full';
            iframeWrapper.style.paddingBottom = '56.25%';
            iframeWrapper.style.height = '0';
            iframeWrapper.innerHTML = `<div id="${playerDivId}" class="absolute top-0 left-0 w-full h-full rounded-lg"></div>`;
            videoContentWrapper.appendChild(iframeWrapper);
            videoPlayerContainer.classList.remove('hidden');
            customControls.classList.remove('hidden');

            if (typeof YT !== 'undefined' && YT.Player) {
                youtubePlayer = new YT.Player(playerDivId, {
                    videoId: youtubeId,
                    playerVars: {
                        'autoplay': 1,
                        'controls': 0,
                        'rel': 0, // Disable related videos at the end
                        'modestbranding': 1,
                        'iv_load_policy': 3
                    },
                    events: {
                        'onReady': onYouTubePlayerReady,
                        'onStateChange': onYouTubePlayerStateChange,
                        'onError': onYouTubePlayerError
                    }
                });
                console.log('Attempting to create YouTube Player for video ID:', youtubeId);
            } else {
                showErrorMessage('YouTube API not ready yet. Please wait a moment and try again.');
                console.error('YouTube IFrame API is not ready yet when trying to create player.');
            }
        } else {
            const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
            const isValidDirectUrl = videoExtensions.some(ext => url.toLowerCase().endsWith(ext));

            if (isValidDirectUrl) {
                currentVideoType = 'direct';
                const videoElement = document.createElement('video');
                videoElement.src = url;
                videoElement.width = '100%';
                videoElement.height = 'auto';
                videoElement.autoplay = true;
                videoElement.controls = false;
                videoElement.className = 'rounded-md w-full max-h-full';
                videoElement.onerror = handleDirectVideoError;
                videoElement.style.display = 'block';

                videoElement.addEventListener('play', updatePlayPauseButton);
                videoElement.addEventListener('pause', updatePlayPauseButton);
                videoElement.addEventListener('timeupdate', updateProgressBar);
                videoElement.addEventListener('loadedmetadata', setDuration);
                videoElement.addEventListener('volumechange', updateVolumeSlider);

                currentVideoElement = videoElement;

                videoContentWrapper.appendChild(videoElement);
                videoPlayerContainer.classList.remove('hidden');
                customControls.classList.remove('hidden');
                updateVolumeSlider();
                updatePlayPauseButton();
            } else {
                showErrorMessage('Please enter a direct URL to a video file (.mp4, .webm, etc.) or a valid YouTube URL.');
            }
        }
    }

    // 8. Event Listeners
    loadVideoButton.addEventListener('click', loadVideo);
    searchButton.addEventListener('click', searchYouTube);
    toggleFullscreenButton.addEventListener('click', toggleFullscreen);
    playPauseButton.addEventListener('click', togglePlayPause);
    seekSlider.addEventListener('input', handleSeekSliderInput);
    volumeSlider.addEventListener('input', changeVolume);

    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            videoPlayerContainer.classList.add('fullscreen-active');
        } else {
            videoPlayerContainer.classList.remove('fullscreen-active');
        }
    });

    // Initialize homepage content
    fetchFeaturedVideo();
    searchResultsDiv.style.display = 'none'; // Ensure search results are hidden on load

    console.log('All event listeners attached.');
});
