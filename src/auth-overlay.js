/* FBI Secure Access Portal — Auth Overlay */

const AuthOverlay = {

    overlay: null,

    showLogin( onSuccess ) {
        this.createOverlay();
        const userList = this.getUserList();

        this.overlay.innerHTML = `
            <div class="auth-modal" id="auth-modal">
                <div class="auth-seal">
                    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+<br>
                    |  F E D E R A L   B U R E A U   O F   I N V E S T I G A T I O N  |<br>
                    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;█▀▀█ █▀▀█ █▀▀█ █▀▀&nbsp;&nbsp;█▀▀█ █▀▀▀ █▀▀ █▀▀█ █▀▀█<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;█▄▄█ █▄▄▀ █▄▄█ █▀▀&nbsp;&nbsp;█▄▄█ █▀▀▀ █▀▀ █▄▄▀ █▄▄█<br>
                    &nbsp;&nbsp;&nbsp;&nbsp;▀&nbsp;&nbsp;▀ ▀ ▀▀▀ ▀ ▀▀▀ ▀▀▀&nbsp;&nbsp;▀ ▀▀▀ ▀▀▀▀ ▀▀▀ ▀ ▀▀▀ ▀ ▀▀▀
                </div>
                <div class="auth-header">
                    <h1>Secure Access Portal</h1>
                    <div class="subtitle">U.S. Department of Justice — Criminal Justice Information Services</div>
                    <div class="class-badge">⛔ TOP SECRET // NOFORN</div>
                </div>
                <div class="auth-form">
                    <div class="field">
                        <label>Agent ID</label>
                        <input type="text" id="auth-userid" placeholder="e.g. 8A73B5" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input type="password" id="auth-password" placeholder="••••••••" autocomplete="off">
                    </div>
                    <div class="auth-buttons">
                        <button class="auth-btn primary" id="auth-login-btn">▶ Authenticate</button>
                        <button class="auth-btn" id="auth-register-btn">Register</button>
                    </div>
                </div>
                <div class="auth-status" id="auth-status"></div>
                <div class="auth-toggle">
                    <a id="auth-to-register">Not registered? Create new agent account →</a>
                </div>
            </div>
        `;

        this.overlay.onclick = ( e ) => {
            if ( e.target === this.overlay ) {
                // Don't close on backdrop click — security
            }
        };

        document.getElementById( "auth-login-btn" ).onclick = () => this.handleLogin( onSuccess );
        document.getElementById( "auth-password" ).onkeydown = ( e ) => {
            if ( e.keyCode === 13 ) this.handleLogin( onSuccess );
        };
        document.getElementById( "auth-userid" ).onkeydown = ( e ) => {
            if ( e.keyCode === 13 ) document.getElementById( "auth-password" ).focus();
        };
        document.getElementById( "auth-to-register" ).onclick = () => this.showRegister( onSuccess );
        document.getElementById( "auth-register-btn" ).onclick = () => this.showRegister( onSuccess );

        setTimeout( () => {
            document.getElementById( "auth-userid" ).focus();
        }, 300 );
    },

    showRegister( onSuccess ) {
        this.createOverlay();

        this.overlay.innerHTML = `
            <div class="auth-modal" id="auth-modal">
                <div class="auth-seal">
                    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+<br>
                    |  F E D E R A L   B U R E A U   O F   I N V E S T I G A T I O N  |<br>
                    +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                </div>
                <div class="auth-header">
                    <h1>New Agent Registration</h1>
                    <div class="subtitle">Create your secure access credentials</div>
                    <div class="class-badge">⛔ CLASSIFIED</div>
                </div>
                <div class="auth-form">
                    <div class="field">
                        <label>Desired Agent ID</label>
                        <input type="text" id="auth-reg-userid" placeholder="e.g. AGENT007" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input type="password" id="auth-reg-password" placeholder="••••••••" autocomplete="off">
                    </div>
                    <div class="field">
                        <label>Display Name (Full Name)</label>
                        <input type="text" id="auth-reg-name" placeholder="e.g. Smith, John" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="auth-buttons">
                        <button class="auth-btn primary" id="auth-reg-submit-btn">▶ Register</button>
                        <button class="auth-btn" id="auth-reg-back-btn">← Back</button>
                    </div>
                </div>
                <div class="auth-status" id="auth-status"></div>
                <div class="auth-toggle">
                    <a id="auth-to-login">Already registered? Login →</a>
                </div>
            </div>
        `;

        document.getElementById( "auth-reg-submit-btn" ).onclick = () => this.handleRegister( onSuccess );
        document.getElementById( "auth-reg-back-btn" ).onclick = () => this.showLogin( onSuccess );
        document.getElementById( "auth-to-login" ).onclick = () => this.showLogin( onSuccess );
        document.getElementById( "auth-reg-password" ).onkeydown = ( e ) => {
            if ( e.keyCode === 13 ) this.handleRegister( onSuccess );
        };

        setTimeout( () => {
            document.getElementById( "auth-reg-userid" ).focus();
        }, 300 );
    },

    handleLogin( onSuccess ) {
        const userId = document.getElementById( "auth-userid" ).value.trim();
        const password = document.getElementById( "auth-password" ).value;
        const statusEl = document.getElementById( "auth-status" );
        const modal = document.getElementById( "auth-modal" );

        if ( !userId ) {
            statusEl.className = "auth-status error";
            statusEl.textContent = "⛔ ERROR: Agent ID is required.";
            modal.classList.add( "shake" );
            setTimeout( () => modal.classList.remove( "shake" ), 500 );
            return;
        }

        const userList = this.getUserList();
        const user = userList.find( ( u ) => u.userId === userId );

        if ( !user ) {
            statusEl.className = "auth-status error";
            statusEl.textContent = `⛔ ACCESS DENIED: Unknown agent ID "${ userId }".`;
            modal.classList.add( "shake" );
            setTimeout( () => modal.classList.remove( "shake" ), 500 );
            return;
        }

        if ( user.password && user.password !== password ) {
            statusEl.className = "auth-status error";
            statusEl.textContent = "⛔ ACCESS DENIED: Invalid password.";
            modal.classList.add( "shake" );
            setTimeout( () => modal.classList.remove( "shake" ), 500 );
            return;
        }

        // Success — show access granted
        statusEl.className = "auth-status info";
        statusEl.textContent = "█ AUTHORIZING";
        setTimeout( () => {
            statusEl.textContent = "█ AUTHORIZING .";
        }, 300 );
        setTimeout( () => {
            statusEl.textContent = "█ AUTHORIZING . .";
        }, 600 );
        setTimeout( () => {
            statusEl.textContent = "█ AUTHORIZING . . .";
        }, 900 );
        setTimeout( () => {
            this.showAccessGranted( userId, onSuccess );
        }, 1200 );
    },

    handleRegister( onSuccess ) {
        const userId = document.getElementById( "auth-reg-userid" ).value.trim();
        const password = document.getElementById( "auth-reg-password" ).value;
        const name = document.getElementById( "auth-reg-name" ).value.trim() || userId;
        const statusEl = document.getElementById( "auth-status" );
        const modal = document.getElementById( "auth-modal" );

        if ( !userId ) {
            statusEl.className = "auth-status error";
            statusEl.textContent = "⛔ ERROR: Agent ID is required.";
            modal.classList.add( "shake" );
            setTimeout( () => modal.classList.remove( "shake" ), 500 );
            return;
        }

        const userList = this.getUserList();
        if ( userList.find( ( u ) => u.userId === userId ) ) {
            statusEl.className = "auth-status error";
            statusEl.textContent = `⛔ ERROR: Agent ID "${ userId }" already exists.`;
            modal.classList.add( "shake" );
            setTimeout( () => modal.classList.remove( "shake" ), 500 );
            return;
        }

        // Add the user to the global userList
        userList.push( {
            userId: userId,
            password: password || "",
            userName: name
        } );

        statusEl.className = "auth-status success";
        statusEl.textContent = `✅ Agent "${ userId }" registered successfully. Redirecting to login...`;

        setTimeout( () => {
            this.showLogin( onSuccess );
            // Pre-fill the user ID
            const input = document.getElementById( "auth-userid" );
            if ( input ) {
                input.value = userId;
                document.getElementById( "auth-password" ).focus();
            }
        }, 1500 );
    },

    showAccessGranted( userId, onSuccess ) {
        const userList = this.getUserList();
        const user = userList.find( ( u ) => u.userId === userId );

        // Set the current user in the kernel
        if ( typeof kernel !== "undefined" && kernel.setCurrentUser ) {
            kernel.setCurrentUser( userId );
        }

        this.overlay.innerHTML = `
            <div class="auth-modal" style="text-align:center; animation: none;">
                <div class="auth-header">
                    <h1 style="color: #00ff88; animation: pulse-glow 2s infinite;">ACCESS GRANTED</h1>
                    <div class="subtitle" style="color: #00ff88;">WELCOME, ${ user ? user.userName.toUpperCase() : userId.toUpperCase() }</div>
                    <div class="subtitle" style="color: #555; margin-top: 20px; font-size: 9px;">
                        You are accessing a U.S. Government information system.<br>
                        Unauthorized access is punishable by law.
                    </div>
                </div>
                <div class="auth-status info" style="color: #00ff88;">
                    Establishing secure connection<span class="cursor"></span>
                </div>
            </div>
        `;

        setTimeout( () => {
            this.overlay.classList.add( "fade-out" );
            setTimeout( () => {
                this.hide();
                if ( onSuccess ) onSuccess( userId );
            }, 800 );
        }, 1500 );
    },

    hide() {
        if ( this.overlay && this.overlay.parentNode ) {
            this.overlay.parentNode.removeChild( this.overlay );
        }
        this.overlay = null;
    },

    createOverlay() {
        if ( this.overlay ) {
            this.overlay.parentNode.removeChild( this.overlay );
        }
        this.overlay = document.createElement( "div" );
        this.overlay.className = "auth-overlay";
        document.body.appendChild( this.overlay );
    },

    getUserList() {
        // Access the global userList from kernel.js
        if ( typeof userList !== "undefined" && userList.length > 0 ) {
            return userList;
        }
        // Fallback: try to load from known users
        return typeof userList !== "undefined" ? userList : [];
    }
};
