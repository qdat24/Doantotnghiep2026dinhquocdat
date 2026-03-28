// ============================================
// CHATBOT WIDGET
// ============================================

class ChatbotWidget {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.quickReplies = [
            'Xin chào',
            'Tư vấn sản phẩm',
            'Giá cả',
            'Vận chuyển',
            'Đổi trả hàng',
            'Liên hệ nhân viên'
        ];
        this.autoReplies = {
            'xin chào': 'Xin chào! Tôi có thể giúp gì cho bạn? 😊',
            'hello': 'Xin chào! Tôi có thể giúp gì cho bạn? 😊',
            'hi': 'Xin chào! Tôi có thể giúp gì cho bạn? 😊',
            'tư vấn sản phẩm': 'Chúng tôi có nhiều sản phẩm nội thất đa dạng. Bạn quan tâm đến sản phẩm nào? (Phòng khách, Phòng ngủ, Nhà bếp, Văn phòng...)',
            'giá cả': 'Giá cả phụ thuộc vào từng sản phẩm. Bạn có thể xem giá chi tiết trên trang sản phẩm. Đơn hàng trên 5 triệu được miễn phí vận chuyển!',
            'vận chuyển': 'Chúng tôi giao hàng toàn quốc. Thời gian: 2-5 ngày (nội thành), 5-7 ngày (ngoại thành). Miễn phí vận chuyển cho đơn hàng trên 5 triệu!',
            'đổi trả hàng': 'Chúng tôi có chính sách đổi trả trong 7 ngày nếu sản phẩm còn nguyên vẹn. Bạn có thể xem chi tiết tại trang "Chính Sách".',
            'liên hệ nhân viên': 'Bạn có thể liên hệ qua:\n📞 Hotline: 0345211386\n📧 Email: quocdat30075@gmail.com\n⏰ Giờ làm việc: 8:00 - 22:00 hàng ngày',
            'cảm ơn': 'Không có gì! Chúc bạn một ngày tốt lành! 😊',
            'thank': 'Không có gì! Chúc bạn một ngày tốt lành! 😊',
            'bye': 'Cảm ơn bạn đã liên hệ! Chúc bạn một ngày tốt lành! 👋'
        };
        
        this.init();
    }
    
    init() {
        this.createWidget();
        this.loadMessages();
        this.setupEventListeners();
        this.showWelcomeMessage();
    }
    
    createWidget() {
        const container = document.createElement('div');
        container.className = 'chatbot-container';
        container.innerHTML = `
            <button class="chatbot-toggle-btn" id="chatbotToggle">
                <i class="fas fa-comments"></i>
            </button>
            <div class="chatbot-window" id="chatbotWindow">
                <div class="chatbot-header">
                    <div>
                        <h3>
                            <i class="fas fa-headset"></i>
                            Hỗ Trợ Khách Hàng
                        </h3>
                        <div class="status">
                            <span class="status-dot"></span>
                            <span>Đang trực tuyến</span>
                        </div>
                    </div>
                    <button class="chatbot-close-btn" id="chatbotClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="chatbot-messages" id="chatbotMessages"></div>
                <div class="chatbot-quick-replies" id="chatbotQuickReplies"></div>
                <div class="chatbot-input-area">
                    <input type="text" 
                           class="chatbot-input" 
                           id="chatbotInput" 
                           placeholder="Nhập tin nhắn của bạn...">
                    <button class="chatbot-send-btn" id="chatbotSend">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }
    
    setupEventListeners() {
        const toggleBtn = document.getElementById('chatbotToggle');
        const closeBtn = document.getElementById('chatbotClose');
        const sendBtn = document.getElementById('chatbotSend');
        const input = document.getElementById('chatbotInput');
        
        toggleBtn.addEventListener('click', () => this.toggle());
        closeBtn.addEventListener('click', () => this.close());
        sendBtn.addEventListener('click', () => this.sendMessage());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.renderQuickReplies();
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        const window = document.getElementById('chatbotWindow');
        if (this.isOpen) {
            window.classList.add('active');
            document.getElementById('chatbotInput').focus();
        } else {
            window.classList.remove('active');
        }
    }
    
    close() {
        this.isOpen = false;
        document.getElementById('chatbotWindow').classList.remove('active');
    }
    
    showWelcomeMessage() {
        const welcomeMsg = 'Xin chào! 👋 Tôi là trợ lý ảo của HOMESTEAD. Tôi có thể giúp bạn:\n\n• Tư vấn sản phẩm\n• Thông tin giá cả\n• Chính sách vận chuyển\n• Đổi trả hàng\n• Liên hệ nhân viên\n\nBạn cần hỗ trợ gì? 😊';
        this.addMessage('bot', welcomeMsg);
    }
    
    renderQuickReplies() {
        const container = document.getElementById('chatbotQuickReplies');
        container.innerHTML = '';
        
        this.quickReplies.forEach(reply => {
            const btn = document.createElement('button');
            btn.className = 'chatbot-quick-reply';
            btn.textContent = reply;
            btn.addEventListener('click', () => {
                this.addMessage('user', reply);
                this.processMessage(reply);
            });
            container.appendChild(btn);
        });
    }
    
    addMessage(sender, text) {
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${sender}`;
        
        const time = new Date().toLocaleTimeString('vi-VN', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const avatar = sender === 'bot' 
            ? '<i class="fas fa-robot"></i>' 
            : '<i class="fas fa-user"></i>';
        
        messageDiv.innerHTML = `
            <div class="avatar">${avatar}</div>
            <div class="message-content">
                ${this.formatMessage(text)}
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.messages.push({ sender, text, time });
        this.saveMessages();
    }
    
    formatMessage(text) {
        // Convert line breaks to <br>
        return text.replace(/\n/g, '<br>');
    }
    
    async sendMessage() {
        const input = document.getElementById('chatbotInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        input.value = '';
        this.addMessage('user', message);
        this.processMessage(message);
    }
    
    async processMessage(message) {
        const lowerMessage = message.toLowerCase();
        let reply = null;
        
        // Check for auto-reply
        for (const [key, value] of Object.entries(this.autoReplies)) {
            if (lowerMessage.includes(key)) {
                reply = value;
                break;
            }
        }
        
        // If no auto-reply, show default response
        if (!reply) {
            reply = 'Cảm ơn bạn đã liên hệ! Để được hỗ trợ tốt hơn, bạn có thể:\n\n📞 Gọi hotline: 0345211386\n📧 Email: quocdat30075@gmail.com\n💬 Để lại tin nhắn tại trang "Liên Hệ"\n\nHoặc bạn có thể hỏi tôi về:\n• Tư vấn sản phẩm\n• Giá cả\n• Vận chuyển\n• Đổi trả hàng';
        }
        
        // Simulate typing delay
        setTimeout(() => {
            this.addMessage('bot', reply);
            
            // If user wants to contact staff, offer to save message
            if (lowerMessage.includes('liên hệ') || lowerMessage.includes('nhân viên')) {
                setTimeout(() => {
                    this.offerContactForm();
                }, 1000);
            }
        }, 500);
        
        // Save message to server
        this.saveMessageToServer(message);
    }
    
    offerContactForm() {
        const messagesContainer = document.getElementById('chatbotMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chatbot-message bot';
        messageDiv.innerHTML = `
            <div class="avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                Bạn có muốn để lại thông tin để nhân viên liên hệ lại không? 
                <br><br>
                <button onclick="window.location.href='/contact'" 
                        style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; margin-top: 8px;">
                    <i class="fas fa-envelope"></i> Đi đến trang Liên Hệ
                </button>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    async saveMessageToServer(message) {
        try {
            const response = await fetch('/api/chatbot-message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                console.error('Failed to save message');
            }
        } catch (error) {
            console.error('Error saving message:', error);
        }
    }
    
    saveMessages() {
        localStorage.setItem('chatbot_messages', JSON.stringify(this.messages));
    }
    
    loadMessages() {
        const saved = localStorage.getItem('chatbot_messages');
        if (saved) {
            try {
                this.messages = JSON.parse(saved);
                // Only load last 10 messages to avoid clutter
                const recentMessages = this.messages.slice(-10);
                this.messages = recentMessages;
                
                // Render messages
                const messagesContainer = document.getElementById('chatbotMessages');
                messagesContainer.innerHTML = '';
                recentMessages.forEach(msg => {
                    const messageDiv = document.createElement('div');
                    messageDiv.className = `chatbot-message ${msg.sender}`;
                    
                    const avatar = msg.sender === 'bot' 
                        ? '<i class="fas fa-robot"></i>' 
                        : '<i class="fas fa-user"></i>';
                    
                    messageDiv.innerHTML = `
                        <div class="avatar">${avatar}</div>
                        <div class="message-content">
                            ${this.formatMessage(msg.text)}
                            <div class="message-time">${msg.time}</div>
                        </div>
                    `;
                    messagesContainer.appendChild(messageDiv);
                });
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                console.error('Error loading messages:', error);
            }
        }
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chatbot = new ChatbotWidget();
});
