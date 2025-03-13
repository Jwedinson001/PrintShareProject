console.log('index.js is loaded');

// Redirect to account page
function goToAccount() {
    window.location.href = 'account.html';
}

// Redirect to settings page
function goToSettings() {
    window.location.href = 'settings.html';
}

// Logout functionality
function logout() {
    localStorage.clear();
    alert('You have been logged out.');
    window.location.reload();
}

// Check if user is logged in
function checkLoginStatus() {
    const signUpBtn = document.getElementById('sign-up-btn');
    const logInBtn = document.getElementById('log-in-btn');
    const userActions = document.getElementById('user-actions');
    const profilePic = document.getElementById('profile-pic');
    const usernameDisplay = document.getElementById('username-display');

    if (localStorage.getItem('userId')) {
        const username = localStorage.getItem('username');
        const profilePictureUrl = localStorage.getItem('profilePictureUrl') || 'images/user.png';

        userActions.style.display = 'flex';
        signUpBtn.style.display = 'none';
        logInBtn.style.display = 'none';

        profilePic.src = profilePictureUrl;
        profilePic.alt = `${username}'s Profile Picture`;
        usernameDisplay.textContent = username;
    } else {
        userActions.style.display = 'none';
        signUpBtn.style.display = 'inline-block';
        logInBtn.style.display = 'inline-block';
    }
}

// Fetch posts dynamically
function loadPosts() {
    fetch('/get-posts')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const postGrid = document.getElementById('post-grid');
                postGrid.innerHTML = '';
                data.posts.forEach(post => {
                    const postCard = document.createElement('div');
                    postCard.classList.add('post-card');
                    postCard.innerHTML = `
                        <h3>${post.title}</h3>
                        <p>${post.content}</p>
                        ${post.image_url ? `<img src="${post.image_url}" alt="Post Image">` : ''}
                        <a href="post_view.html?postId=${post.id}" class="view-post-button">View Post</a>
                    `;
                    postGrid.prepend(postCard); // Append to the top
                });
            }
        })
        .catch(error => console.error('Error fetching posts:', error));
}

// Create a new post
function createPost() {
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const imageFile = document.getElementById('post-image').files[0];
    const userId = localStorage.getItem('userId');

    if (!userId) {
        alert('You must be logged in to create a post.');
        return;
    }

    if (!title || !content) {
        alert('Title and content cannot be empty.');
        return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    formData.append('userId', userId);
    if (imageFile) {
        formData.append('image', imageFile);
    }

    fetch('/create-post', {
        method: 'POST',
        body: formData,
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                alert('Post created successfully!');
                document.getElementById('post-title').value = '';
                document.getElementById('post-content').value = '';
                document.getElementById('post-image').value = '';
                loadPosts();
            } else {
                alert('Error creating post: ' + data.message);
            }
        })
        .catch(error => console.error('Error creating post:', error));
}

// Handle live chat form submission
function handleChatFormSubmission(event) {
    event.preventDefault(); // Prevent form from refreshing the page
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    const userId = localStorage.getItem('userId');
    const receiverId = 0; // Default receiver ID to 0

    if (!userId) {
        alert('You must be logged in to send a message.');
        return;
    }

    if (message) {
        fetch('/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: userId, receiverId, content: message }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                chatInput.value = ''; // Clear the input field
                loadChatMessages(); // Reload chat messages
            } else {
                alert('Error sending message: ' + data.message);
            }
        })
        .catch(error => console.error('Error sending message:', error));
    }
}

// Load chat messages
function loadChatMessages() {
    const userId = localStorage.getItem('userId'); // Ensure userId is defined
    fetch('/messages')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const chatMessagesDiv = document.getElementById('chat-messages');
                chatMessagesDiv.innerHTML = '';
                data.messages.forEach(message => {
                    const messageDiv = document.createElement('div');
                    messageDiv.classList.add('message');
                    messageDiv.classList.add(message.sender_id === userId ? 'sent' : 'received');
                    messageDiv.innerHTML = `
                        <strong>${message.sender_id === userId ? 'You' : message.sender_username}</strong>
                        <span>${message.content}</span>
                        <small>${new Date(message.created_at).toLocaleTimeString()}</small>
                    `;
                    chatMessagesDiv.appendChild(messageDiv);
                });
                chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to the bottom
            }
        })
        .catch(error => console.error('Error fetching messages:', error));
}

// Typing indicator
function handleTypingIndicator() {
    const chatInput = document.getElementById('chat-input');
    const userId = localStorage.getItem('userId');

    chatInput.addEventListener('input', () => {
        fetch('/typing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, typing: chatInput.value.length > 0 }),
        });
    });

    setInterval(() => {
        fetch('/typing-status')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const typingIndicator = document.getElementById('typing-indicator');
                if (data.typing && data.userId !== userId) {
                    typingIndicator.textContent = `${data.username} is typing...`;
                } else {
                    typingIndicator.textContent = '';
                }
            })
            .catch(error => console.error('Error fetching typing status:', error));
    }, 1000);
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path.includes('settings.html')) {
        handleSettingsPage();
    } else if (path.includes('post_view.html')) {
        handlePostViewPage();
    } else if (path.includes('account.html')) {
        handleAccountPage();
    } else if (path.includes('chatroom.html')) {
        document.getElementById('chat-form').addEventListener('submit', handleChatFormSubmission);
        loadChatMessages();
        setInterval(loadChatMessages, 2000);
        handleTypingIndicator();
    } else {
        checkLoginStatus();
        loadPosts();
        document.getElementById('chat-form').addEventListener('submit', handleChatFormSubmission);
        loadChatMessages(); // Load chat messages on the main page
        setInterval(loadChatMessages, 2000); // Refresh chat messages every 2 seconds
    }
});