// Global scope variables
const defaultServerAddress = "localhost";
let serverDatabase = {};
let userDatabase = {};
let userList = [];
let mailList = [];
let archiveList = [];
let cmdLine_;
let output_;
let serverDate = { day: "", month: "", year: "", reference: "" };

function initDateObject() {
    const date = new Date();
    const day = serverDatabase.day ? serverDatabase.day : date.getDate();
    const month = serverDatabase.month ? serverDatabase.month : date.getMonth() + 1;
    const year = serverDatabase.year ? serverDatabase.year : date.getFullYear();
    const reference = serverDatabase.reference ? serverDatabase.reference : "(太阳系标准时间)";
    serverDate = { day, month, year, reference };
}

function debugObject( obj ) {
    for ( const property in obj ) {
        console.log( `${ property }: ${ JSON.stringify( obj[ property ] ) }` );
        output( `${ property }: ${ JSON.stringify( obj[ property ] ) }` );
    }
}

/**
 * Set Header and Prompt informations.
 *
 * This function is useful to avoid code repetition.
 *
 * @param {String} msg A message to be showed when done
 */
function setHeader( msg ) {
    // Setting correct header icon and terminal name
    const promptText = `[${ userDatabase.userName }@${ serverDatabase.terminalID }] # `;

    initDateObject();
    const dateStr = `${ serverDate.day }/${ serverDate.month }/${ serverDate.year }`;
    const imgUrl = `config/network/${ serverDatabase.serverAddress }/${ serverDatabase.iconName }`;
    const imgSize = serverDatabase.iconSize || 100;
    const header = `
    <img src="${ imgUrl }" width="${ imgSize }" height="${ imgSize }"
         style="float: left; padding-right: 10px" class="${ serverDatabase.iconClass || "" }">
    <h2 style="letter-spacing: 4px">${ serverDatabase.serverName }</h2>
    <p>已登录: ${ serverDatabase.serverAddress } (&nbsp;${ dateStr }&nbsp;) </p>
    ${ serverDatabase.headerExtraHTML || "" }
    <p>输入 "help" 获取更多信息。</p>
    `;
    // Clear content:
    output_.innerHTML = "";
    cmdLine_.value = "";
    if ( term ) {
        term.loadHistoryFromLocalStorage( serverDatabase.initialHistory );
    }
    output( [ header, msg ] ).then( () => applySFX() );
    $( ".prompt" ).html( promptText );
}

/**
 * Cross-browser impl to get document's height.
 *
 * This function is necessary to auto-scroll to the end of page after each terminal command.
 */
function getDocHeight_() {
    const doc = document;
    return Math.max(
        Math.max( doc.body.scrollHeight, doc.documentElement.scrollHeight ),
        Math.max( doc.body.offsetHeight, doc.documentElement.offsetHeight ),
        Math.max( doc.body.clientHeight, doc.documentElement.clientHeight )
    );
}

/**
 * Scroll to bottom and clear the input value for a new line.
 */
function newLine() {
    window.scrollTo( 0, getDocHeight_() );
    cmdLine_.value = ""; // Clear/setup line for next input.
}

/**
 * Display content as terminal output.
 *
 * @param {String} data The string to be returned as a print in terminal
 * @param {Array} data The array to be returned as a print in terminal
 */
function output( data ) {
    return new Promise( ( resolve ) => {
        let delayed = 0;

        if ( data && data.constructor === Object ) {
            delayed = data.delayed;
            data = data.text;
        }

        if ( data && data.constructor === Array ) {
            if ( delayed && data.length > 0 ) {
                outputLinesWithDelay( data, delayed, () => resolve( newLine() ) );
                return;
            }
            $.each( data, ( _, value ) => {
                printLine( value );
            } );
        } else if ( data ) {
            printLine( data );
        }
        resolve( newLine() );
    } );
}

/**
 * Print lines of content with some delay between them.
 *
 * @param {Array} lines list of content to display
 * @param {Number} delayed delay in milliseconds between which to display lines
 */
function outputLinesWithDelay( lines, delayed, resolve ) {
    const line = lines.shift();
    printLine( line );
    if ( lines.length > 0 ) {
        setTimeout( outputLinesWithDelay, delayed, lines, delayed, resolve );
    } else if ( resolve ) {
        resolve();
    }
}

/**
 * Display some text, or an image, on a new line.
 *
 * @param {String} data text to display
 * @param {Object} data information on what to display
 */
function printLine( data ) {
    data ||= "";
    if ( !data.startsWith( "<" ) ) {
        data = `<p>${ data }</p>`;
    }
    output_.insertAdjacentHTML( "beforeEnd", data );
    applySFX();
}

function applySFX() {
    $( output_ ).find( ".desync" ).each( ( _, elem ) => {
        const text = elem.textContent.trim();
        if ( text ) {
            elem.dataset.text = text;
        }
    } );
    $( output_ ).find( "img.glitch" ).filter( once ).each( ( _, img ) => glitchImage( img ) );
    $( output_ ).find( "img.particle" ).filter( once ).each( ( _, img ) => particleImage( img ) );
    $( output_ ).find( ".hack-reveal" ).filter( once ).each( ( _, elem ) => hackRevealText( elem, elem.dataset ) );
}

function once( _, elem ) {
    if ( elem.dataset.marked ) {
        return false;
    }
    elem.dataset.marked = true;
    return true;
}

/**
 * The Kernel will handle all software (system calls).
 *
 * The app name will be checked first if it exists as a system 'native' command.
 * If it doesn't, it will look for a custom software defined at software.json.
 *
 * You can define commands with filetypes by naming the function as command_type.
 * The kernel will handle every `.` as a `_` when looking for the correct software.
 * i.e. the `bar_exe` function needs to be called as the `bar.exe` command in the Terminal.
 *
 * @param {String} app The app name
 * @param {Array} args A list of Strings as args
 */
function kernel( appName, args ) {
    const program = allowedSoftwares()[ appName ];
    if ( program ) {
        return software( appName, program, args );
    }
    const systemApp = system[ appName ] || system[ appName.replace( ".", "_" ) ];
    const appDisabled = ( program === null );
    if ( !systemApp || appDisabled ) {
        return Promise.reject( new CommandNotFoundError( appName ) );
    }
    return systemApp( args );
}

/**
 * Attempts to connect to a server.
 * If successful, sets global variables serverDatabase / userDatabase / userList / mailList
 */
kernel.connectToServer = function connectToServer( serverAddress, userName, passwd ) {
    return new Promise( ( resolve, reject ) => {
        if ( serverAddress === serverDatabase.serverAddress ) {
            reject( new AlreadyOnServerError( serverAddress ) );
            return;
        }
        $.get( `config/network/${ serverAddress }/manifest.json`, ( serverInfo ) => {
            if ( !userName && serverInfo.defaultUser ) {
                serverDatabase = serverInfo;
                userDatabase = serverInfo.defaultUser;
                $.get( `config/network/${ serverInfo.serverAddress }/userlist.json`, ( users ) => {
                    userList = users;
                } );
                $.get( `config/network/${ serverInfo.serverAddress }/mailserver.json`, ( mails ) => {
                    mailList = mails;
                } );
                setHeader( "连接成功" );
                resolve();
            } else if ( userName ) {
                $.get( `config/network/${ serverInfo.serverAddress }/userlist.json`, ( users ) => {
                    const matchingUser = users.find( ( user ) => user.userId === userName );
                    if ( !matchingUser ) {
                        reject( new UnknownUserError( userName ) );
                        return;
                    }
                    if ( matchingUser.password && matchingUser.password !== passwd ) {
                        reject( new InvalidPasswordError( userName ) );
                        return;
                    }
                    serverDatabase = serverInfo;
                    userDatabase = matchingUser;
                    userList = users;
                    $.get( `config/network/${ serverInfo.serverAddress }/mailserver.json`, ( mails ) => {
                        mailList = mails;
                    } );
                    setHeader( "连接成功" );
                    resolve();
                } ).fail( () => {
                    reject( new AddressNotFoundError( serverAddress ) );
                } );
            } else {
                reject( new ServerRequireUsernameError( serverAddress ) );
            }
        } ).fail( ( ...args ) => {
            console.error( "[connectToServer] Failure:", args );
            reject( new AddressNotFoundError( serverAddress ) );
        } );
    } );
};

/**
 * This will initialize the kernel function.
 *
 * It will define the help functions, set some important variables and connect the databases.
 *
 * @param {Object} cmdLineContainer The Input.cmdline right of the div.prompt
 * @param {Object} outputContainer The output element inside the div#container
 */
// Allow external code to set the current user (used by auth overlay)
kernel.setCurrentUser = function setCurrentUser( userId ) {
    const user = userList.find( ( u ) => u.userId === userId );
    if ( user ) {
        userDatabase = user;
        setHeader( "身份验证成功" );
    }
};

kernel.init = function init( cmdLineContainer, outputContainer ) {
    return new Promise( ( resolve, reject ) => {
        cmdLine_ = document.querySelector( cmdLineContainer );
        output_ = document.querySelector( outputContainer );

        $.when(
            $.get( "config/software.json", ( softwareData ) => {
                softwareInfo = softwareData;
                $.get("config/records.json", (records) => { archiveList = records; });
                $.get("config/profiles.json", (profiles) => { profileList = profiles; });
                kernel.connectToServer( defaultServerAddress );
            } )
        )
            .done( () => {
                resolve( true );
            } )
            .fail( ( err, msg, details ) => {
                console.error( "[init] Failure:", err, msg, details );
                reject( new JsonFetchParseError( msg ) );
            } );
    } );
};

/**
 * Internal command functions.
 *
 * This is where the internal commands are located.
 * This should have every non-custom software command functions.
 */
system = {
    dumpdb() {
        return new Promise( () => {
            output( ":: serverDatabase - connected server information" );
            debugObject( serverDatabase );
            output( "----------" );
            output( ":: userDatabase - connected user information" );
            debugObject( userDatabase );
            output( "----------" );
            output( ":: userList - list of users registered in the connected server" );
            debugObject( userList );
        } );
    },

    whoami() {
        return new Promise( ( resolve ) => {
            resolve(
                `${ serverDatabase.serverAddress }/${ userDatabase.userId }`
            );
        } );
    },

    clear() {
        return new Promise( ( resolve ) => {
            setHeader();
            resolve( false );
        } );
    },

    date() {
        return new Promise( ( resolve ) => {
            const date = new Date();
            const time = `${ date.getHours() }:${ date.getMinutes() }:${ date.getSeconds() }`;
            resolve( String( `${ serverDate.month } ${ serverDate.day } ${ serverDate.year } ${ time } ${ serverDate.reference }` ) );
        } );
    },

    echo( args ) {
        return new Promise( ( resolve ) => {
            resolve( args.join( " " ) );
        } );
    },

    help( args ) {
        return new Promise( ( resolve ) => {
            const programs = allowedSoftwares();
            if ( args.length === 0 ) {
                const cmdNames = Object.keys( system ).filter(
                    ( cmd ) => {
                        const program = programs[ cmd ];
                        return program !== null && !( program && program.secretCommand ) && cmd !== "dumpdb"; // hidden system command
                    }
                );
                const progNames = Object.keys( programs ).filter(
                    ( pName ) => programs[ pName ] && !programs[ pName ].secretCommand
                );
                Array.prototype.push.apply( cmdNames, progNames );
                cmdNames.sort();
                resolve( [
                    "输入 'help 命令名' 可查看该命令的详细帮助信息。",
                    "可用命令列表：",
                    `<div class="ls-files">${ cmdNames.join( "<br>" ) }</div>`,
                    "可使用 ↑ ↓ 方向键浏览命令历史。",
                    "按 TAB 键可自动补全命令。"
                ] );
            } else if ( args[ 0 ] === "clear" ) {
                resolve( [ "用法:", "> clear", "清空终端屏幕内容，不影响命令历史。" ] );
            } else if ( args[ 0 ] === "date" ) {
                resolve( [ "用法:", "> date", "显示当前日期和时间。" ] );
            } else if ( args[ 0 ] === "echo" ) {
                resolve( [ "用法:", "> echo 文本", "将输入的文本回显到终端。" ] );
            } else if ( args[ 0 ] === "help" ) {
                resolve( [ "用法:", "> help", "显示帮助信息，列出服务器上可用的所有命令。" ] );
            } else if ( args[ 0 ] === "history" ) {
                resolve( [ "用法:", "> history", "显示你在此终端中输入过的所有命令历史。" ] );
            } else if ( args[ 0 ] === "login" ) {
                resolve( [ "用法:", "> login 用户名:密码", "切换账户：以其他注册用户的身份登录，以访问其数据文件和消息。" ] );
            } else if ( args[ 0 ] === "mail" ) {
                resolve( [ "用法:", "> mail", "> mail inbox", "> mail sent", "查看邮箱中的消息。'inbox' 显示收件箱，'sent' 显示已发送。" ] );
            } else if ( args[ 0 ] === "ping" ) {
                resolve( [
                    "用法:",
                    "> ping 地址",
                    "尝试连接一个有效的服务器地址。",
                    "如果 ping 没有返回有效响应，说明地址可能不正确、不存在或无法从本地访问。"
                ] );
            } else if ( args[ 0 ] === "read" ) {
                resolve( [ "用法:", "> read <索引>", "> read sent <索引>", "读取邮件消息。使用 'read sent <n>' 读取已发送的邮件。" ] );
            } else if ( args[ 0 ] === "grep" ) {
                resolve( [ "用法:", "> grep 关键词", "在消息、用户数据、档案和存档中搜索指定关键词。" ] );
            } else if ( args[ 0 ] === "send" ) {
                resolve( [ "用法:", "> send [用户名]", "向其他用户发送消息。系统将提示输入详细信息。" ] );
            } else if ( args[ 0 ] === "register" ) {
                resolve( [ "用法:", "> register [用户ID 密码 显示名称]", "在服务器上注册新用户。省略参数将进入交互模式。" ] );
            } else if ( args[ 0 ] === "profile" ) {
                resolve( [ "用法:", "> profile list", "> profile view <用户ID>", "> profile edit", "查看成员档案或编辑自己的档案。" ] );
            } else if ( args[ 0 ] === "archive" ) {
                resolve( [ "用法:", "> archive list | view <ID> | new", "管理机密存档：列出所有记录、查看详情或创建新记录。" ] );
            } else if ( args[ 0 ] === "ssh" ) {
                resolve( [
                    "用法:",
                    "> ssh 地址",
                    "> ssh 用户名@地址",
                    "> ssh 用户名:密码@地址",
                    "连接到互联网上的指定服务器。",
                    "如果服务器没有默认用户，可能需要指定用户名。",
                    "如果用户账户受密码保护，则需要输入密码。"
                ] );
            } else if ( args[ 0 ] === "whoami" ) {
                resolve( [ "用法:", "> whoami", "显示当前连接的服务器以及登录用户信息。" ] );
            } else if ( args[ 0 ] in softwareInfo ) {
                const customProgram = programs[ args[ 0 ] ];
                if ( customProgram.help ) {
                    resolve( [ "Usage:", `> ${ args[ 0 ] }`, customProgram.help ] );
                }
            } else if ( args[ 0 ] in system && args[ 0 ] !== "dumpdb" ) {
                console.error( `Missing help message for system command: ${ args[ 0 ] }` );
            } else {
                resolve( [ `未知命令：${ args[ 0 ] }` ] );
            }
        } );
    },

    login( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( !args ) {
                reject( new UsernameIsEmptyError() );
                return;
            }
            let userName = "";
            let passwd = "";
            try {
                [ userName, passwd ] = userPasswordFrom( args[ 0 ] );
            } catch ( error ) {
                reject( error );
                return;
            }
            if ( !userName ) {
                reject( new UsernameIsEmptyError() );
                return;
            }
            const matchingUser = userList.find( ( user ) => user.userId === userName );
            if ( !matchingUser ) {
                reject( new UnknownUserError( userName ) );
                return;
            }
            if ( matchingUser.password && matchingUser.password !== passwd ) {
                reject( new InvalidPasswordError( userName ) );
                return;
            }
            userDatabase = matchingUser;
            setHeader( "登录成功" );
            resolve();
        } );
    },

    logout() {
        return new Promise( () => {
            location.reload();
        } );
    },

    exit() {
        return new Promise( () => {
            location.reload();
        } );
    },

    register( args ) {
        return new Promise( ( resolve, reject ) => {
            function promptForUserId() {
                readPrompt( "新用户ID: " ).then( ( userId ) => {
                    if ( !userId ) {
                        reject( new UsernameIsEmptyError() );
                        return;
                    }
                    if ( userList.find( ( u ) => u.userId === userId ) ) {
                        reject( new UserAlreadyExistsError( userId ) );
                        return;
                    }
                    promptForPassword( userId );
                } );
            }

            function promptForPassword( userId ) {
                readPrompt( "密码: " ).then( ( password ) => {
                    promptForName( userId, password );
                } );
            }

            function promptForName( userId, password ) {
                readPrompt( "显示名称: " ).then( ( userName ) => {
                    userList.push( {
                        userId: userId,
                        password: password || "",
                        userName: userName || userId
                    } );
                    resolve( `用户 ${ userId } 注册成功。现在可以使用以下命令登录：login ${ userId }:${ password || "(无密码)" }` );
                } );
            }

            if ( args && args.length >= 2 ) {
                const userId = args[ 0 ];
                if ( userList.find( ( u ) => u.userId === userId ) ) {
                    reject( new UserAlreadyExistsError( userId ) );
                    return;
                }
                const password = args[ 1 ];
                const userName = args.slice( 2 ).join( " " ) || userId;
                userList.push( {
                    userId: userId,
                    password: password,
                    userName: userName
                } );
                resolve( `用户 ${ userId } 注册成功。现在可以使用以下命令登录：login ${ userId }:${ password }` );
                return;
            }

            promptForUserId();
        } );
    },

    archive( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( !args || args.length === 0 ) {
                resolve( "用法: archive list | view <ID> | new" );
                return;
            }
            const subcmd = args[ 0 ].toLowerCase();

            if ( subcmd === "list" ) {
                if ( !archiveList || archiveList.length === 0 ) {
                    resolve( "存档中未找到记录。" );
                    return;
                }
                const lines = [ "--- 机密存档 ---", "" ];
                archiveList.forEach( ( record ) => {
                    lines.push( `[${ record.id }] ${ record.title }` );
                    lines.push( `    ${ record.date } | ${ record.classification }` );
                    lines.push( "" );
                } );
                lines.push( `记录总数: ${ archiveList.length }` );
                resolve( lines );
                return;
            }

            if ( subcmd === "view" ) {
                const recordId = args[ 1 ];
                if ( !recordId ) {
                    resolve( "用法: archive view <记录ID>" );
                    return;
                }
                const record = archiveList.find( ( r ) => r.id.toUpperCase() === recordId.toUpperCase() );
                if ( !record ) {
                    resolve( `存档中未找到记录"${ recordId }"。` );
                    return;
                }
                resolve( [
                    "=================================================================",
                    `记录ID: ${ record.id }`,
                    `标题: ${ record.title }`,
                    `日期: ${ record.date }`,
                    `密级: ${ record.classification }`,
                    "=================================================================",
                    "",
                    record.body,
                    "",
                    "=================================================================",
                    "文件结束"
                ] );
                return;
            }

            if ( subcmd === "new" ) {
                readPrompt( "标题: " ).then( ( title ) => {
                    if ( !title ) {
                        resolve( "存档创建已取消。" );
                        return;
                    }
                    readPrompt( "密级 (绝密 / 机密 / 秘密): " ).then( ( classification ) => {
                        readPrompt( "正文内容: " ).then( ( body ) => {
                            const result = archiveCreate( title, classification || "机密", body );
                            resolve( result );
                        } );
                    } );
                } );
                return;
            }

            resolve( `未知子命令: ${ subcmd }. 用法: archive list | view <ID> | new` );
        } );
    },

    profile( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( !args || args.length === 0 || args[ 0 ] === "list" ) {
                if ( !profileList || profileList.length === 0 ) {
                    resolve( "未找到档案。" );
                    return;
                }
                const lines = [ "--- 成员档案 ---", "" ];
                profileList.forEach( ( p ) => {
                    const user = userList.find( ( u ) => u.userId === p.userId );
                    const displayName = user ? user.userName : p.realName;
                    lines.push( `${ p.userId } — ${ displayName }` );
                    lines.push( `    ${ p.title }, ${ p.department }` );
                    lines.push( "" );
                } );
                lines.push( `成员总数: ${ profileList.length }` );
                resolve( lines );
                return;
            }

            if ( args[ 0 ] === "view" ) {
                const targetId = args[ 1 ];
                if ( !targetId ) {
                    resolve( "用法: profile view <用户ID>" );
                    return;
                }
                const profile = profileList.find( ( p ) => p.userId.toUpperCase() === targetId.toUpperCase() );
                if ( !profile ) {
                    resolve( `未找到用户 "${ targetId }" 的档案。` );
                    return;
                }
                const user = userList.find( ( u ) => u.userId === profile.userId );
                const displayName = user ? user.userName : profile.realName;
                resolve( [
                    "==============================================",
                    `用户ID:     ${ profile.userId }`,
                    `姓名:       ${ profile.realName } (${ displayName })`,
                    `职位:       ${ profile.title }`,
                    `部门:       ${ profile.department }`,
                    `邮箱:       ${ profile.email }`,
                    `加入日期:   ${ profile.joined }`,
                    "==============================================",
                    "",
                    profile.bio || "(no biography)",
                    "",
                    "==============================================",
                    "档案结束"
                ] );
                return;
            }

            if ( args[ 0 ] === "edit" ) {
                let currentProfile = profileList.find( ( p ) => p.userId === userDatabase.userId );
                if ( !currentProfile ) {
                    currentProfile = {
                        userId: userDatabase.userId,
                        realName: userDatabase.userName || "",
                        title: "",
                        department: "",
                        email: "",
                        bio: "",
                        joined: new Date().toISOString().split( "T" )[ 0 ]
                    };
                    profileList.push( currentProfile );
                }
                readPrompt( `真实姓名 [${ currentProfile.realName }]: ` ).then( ( realName ) => {
                    if ( realName ) currentProfile.realName = realName;
                    readPrompt( `职位 [${ currentProfile.title }]: ` ).then( ( title ) => {
                        if ( title ) currentProfile.title = title;
                        readPrompt( `部门 [${ currentProfile.department }]: ` ).then( ( department ) => {
                            if ( department ) currentProfile.department = department;
                            readPrompt( `邮箱 [${ currentProfile.email }]: ` ).then( ( email ) => {
                                if ( email ) currentProfile.email = email;
                                readPrompt( `简介 [${ currentProfile.bio }]: ` ).then( ( bio ) => {
                                    if ( bio ) currentProfile.bio = bio;
                                    resolve( "档案更新成功。" );
                                } );
                            } );
                        } );
                    } );
                } );
                return;
            }

            resolve( `未知子命令: ${ args[ 0 ] }. 用法: profile list | view <用户ID> | edit` );
        } );
    },

    history() {
        return new Promise( ( resolve ) => {
            const messageList = history_.map( ( line, i ) => `[${ i }] ${ line }` ); // eslint-disable-line no-undef
            resolve( messageList );
        } );
    },

    mail( args ) {
        return new Promise( ( resolve, reject ) => {
            const showSent = args && args.length > 0 && ( args[ 0 ] === "sent" || args[ 0 ] === "-s" );
            const showInbox = !showSent;

            if ( showInbox ) {
                const messageList = mailList.filter( ( mail ) => mail.to.includes( userDatabase.userId ) )
                    .map( ( mail, i ) => `[${ i }] ${ mail.title }` );
                if ( messageList.length === 0 ) {
                    reject( new MailServerIsEmptyError() );
                    return;
                }
                resolve( [ "--- 收件箱 ---", "", ...messageList ] );
            } else {
                const sentList = mailList.filter( ( mail ) => mail.from === userDatabase.userId )
                    .map( ( mail, i ) => `[${ i }] To: ${ mail.to.join( "," ) } — ${ mail.title }` );
                if ( sentList.length === 0 ) {
                    resolve( "暂无已发送消息。" );
                    return;
                }
                resolve( [ "--- 发件箱 ---", "", ...sentList ] );
            }
        } );
    },

    read( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( !args || args.length === 0 ) {
                reject( new InvalidMessageKeyError() );
                return;
            }

            const showSent = args[ 0 ] === "sent" || args[ 0 ] === "-s";
            let mailIndex;
            if ( showSent ) {
                mailIndex = Number( args[ 1 ] );
            } else {
                mailIndex = Number( args[ 0 ] );
            }

            let messageList;
            if ( showSent ) {
                messageList = mailList.filter( ( mail ) => mail.from === userDatabase.userId );
            } else {
                messageList = mailList.filter( ( mail ) => mail.to.includes( userDatabase.userId ) );
            }

            const mailAtIndex = messageList[ mailIndex ];
            if ( !mailAtIndex ) {
                reject( new InvalidMessageKeyError() );
                return;
            }

            let message = [];
            message.push( "---------------------------------------------" );
            message.push( `发件人: ${ mailAtIndex.from }` );
            message.push( `收件人: ${ mailAtIndex.to.join( ", " ) }@${ serverDatabase.terminalID }` );
            message.push( "---------------------------------------------" );
            message = [ ...message, ...mailAtIndex.body.split( "  " ) ];
            resolve( message );
        } );
    },

    grep( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( !args || args.length === 0 ) {
                reject( new SearchTermEmptyError() );
                return;
            }
            const keyword = args.join( " " ).toLowerCase();
            const results = [];

            mailList.forEach( ( mail, i ) => {
                if ( mail.title.toLowerCase().includes( keyword ) ||
                     mail.body.toLowerCase().includes( keyword ) ) {
                    results.push( `[邮件 ${ i }] 来自: ${ mail.from } — ${ mail.title }` );
                }
            } );

            userList.forEach( ( user ) => {
                if ( user.userId.toLowerCase().includes( keyword ) ||
                     user.userName.toLowerCase().includes( keyword ) ) {
                    results.push( `[用户] ${ user.userId } / ${ user.userName }` );
                }
            } );

            if ( archiveList && archiveList.length > 0 ) {
                archiveList.forEach( ( record ) => {
                    if ( record.title.toLowerCase().includes( keyword ) ||
                         record.body.toLowerCase().includes( keyword ) ||
                         record.id.toLowerCase().includes( keyword ) ) {
                        results.push( `[存档 ${ record.id }] ${ record.title } (${ record.classification })` );
                    }
                } );
            }

            if ( profileList && profileList.length > 0 ) {
                profileList.forEach( ( p ) => {
                    if ( p.userId.toLowerCase().includes( keyword ) ||
                         p.realName.toLowerCase().includes( keyword ) ||
                         p.title.toLowerCase().includes( keyword ) ||
                         p.department.toLowerCase().includes( keyword ) ||
                         p.bio.toLowerCase().includes( keyword ) ) {
                        results.push( `[档案 ${ p.userId }] ${ p.realName } — ${ p.title }` );
                    }
                } );
            }

            if ( results.length === 0 ) {
                resolve( `未找到与 "${ args.join( " " ) }" 相关的结果` );
            } else {
                resolve( [ `"${ args.join( " " ) }" 的搜索结果:`, ...results ] );
            }
        } );
    },

    send( args ) {
        return new Promise( ( resolve, reject ) => {
            function promptForRecipient() {
                output( { text: [ "请输入收件人用户ID:", "可用用户: " + userList.map( ( u ) => u.userId ).join( ", " ) ], delayed: 0 } );
                readPrompt( "收件人: " ).then( ( recipient ) => {
                    const targetUser = userList.find( ( u ) => u.userId === recipient );
                    if ( !targetUser ) {
                        reject( new SendRecipientNotFoundError() );
                        return;
                    }
                    promptForSubject( recipient );
                } );
            }

            function promptForSubject( recipient ) {
                readPrompt( "主题: " ).then( ( title ) => {
                    promptForBody( recipient, title || "(no subject)" );
                } );
            }

            function promptForBody( recipient, title ) {
                readPrompt( "消息内容: " ).then( ( body ) => {
                    mailList.push( {
                        from: userDatabase.userId,
                        to: [ recipient ],
                        title: title,
                        body: body || "(empty)"
                    } );
                    resolve( "消息已发送至 " + recipient );
                } );
            }

            if ( !args || args.length === 0 ) {
                promptForRecipient();
                return;
            }

            const recipient = args[ 0 ];
            const targetUser = userList.find( ( u ) => u.userId === recipient );
            if ( !targetUser ) {
                reject( new SendRecipientNotFoundError() );
                return;
            }

            if ( args.length > 1 ) {
                const title = args[ 1 ];
                const body = args.slice( 2 ).join( " " ) || title;
                mailList.push( {
                    from: userDatabase.userId,
                    to: [ recipient ],
                    title: title,
                    body: body
                } );
                resolve( "消息已发送至 " + recipient );
            } else {
                promptForSubject( recipient );
            }
        } );
    },

    ping( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( args === "" ) {
                reject( new AddressIsEmptyError() );
                return;
            }

            $.get( `config/network/${ args }/manifest.json`, ( serverInfo ) => {
                resolve( `Server ${ serverInfo.serverAddress } (${ serverInfo.serverName }) can be reached` );
            } )
                .fail( () => reject( new AddressNotFoundError( args ) ) );
        } );
    },

    telnet() {
        return new Promise( ( _, reject ) => {
            reject( new Error( "telnet 不安全且已弃用 — 请使用 ssh 代替" ) );
        } );
    },

    ssh( args ) {
        return new Promise( ( resolve, reject ) => {
            if ( args === "" ) {
                reject( new AddressIsEmptyError() );
                return;
            }
            let userName = "";
            let passwd = "";
            let serverAddress = args[ 0 ];
            if ( serverAddress.includes( "@" ) ) {
                const splitted = serverAddress.split( "@" );
                if ( splitted.length !== 2 ) {
                    reject( new InvalidCommandParameter( "ssh" ) );
                    return;
                }
                serverAddress = splitted[ 1 ];
                try {
                    [ userName, passwd ] = userPasswordFrom( splitted[ 0 ] );
                } catch ( error ) {
                    reject( error );
                    return;
                }
            }
            kernel.connectToServer( serverAddress, userName, passwd ).then( resolve ).catch( reject );
        } );
    }
};

function userPasswordFrom( creds ) {
    if ( !creds.includes( ":" ) ) {
        return [ creds, "" ];
    }
    const splitted = creds.split( ":" );
    if ( splitted.length !== 2 ) {
        throw new InvalidCredsSyntaxError();
    }
    return splitted;
}

/**
 * The custom software caller.
 *
 * This will look for custom softwares from `software.json`.
 *
 * @param {String} progName The software name
 * @param {String} args Args to be handled if any
 */
function software( progName, program, args ) {
    return new Promise( ( resolve, reject ) => {
        if ( program ) {
            if ( program.clear ) {
                system.clear().then( runSoftware( progName, program, args ).then( resolve, reject ) );
            } else {
                runSoftware( progName, program, args ).then( resolve, reject );
            }
        } else {
            reject( new CommandNotFoundError( progName ) );
        }
    } );
}

/**
 * Run the specified program
 *
 * @param {String} progName The software name
 * @param {Object} program Command definition from sofwtare.json
 * @param {String} args Args to be handled if any
 */
function runSoftware( progName, program, args ) {
    return new Promise( ( resolve ) => {
        let msg;
        if ( program.message ) {
            msg = { text: program.message, delayed: program.delayed };
        } else {
            msg = window[ progName ]( args ) || "";
            if ( msg.constructor === Object ) {
                if ( !msg.onInput ) {
                    throw new Error( "An onInput callback must be defined!" );
                }
                if ( msg.message ) {
                    output( msg.message );
                }
                readPrompt( msg.prompt || ">" ).then( ( input ) => msg.onInput( input ) )
                    .then( ( finalMsg ) => resolve( finalMsg ) );
                return;
            }
        }
        resolve( msg );
    } );
}

/**
 * Read user input
 *
 * @param {String} promptText The text prefix to display before the <input> prompt
 */
function readPrompt( promptText ) {
    return new Promise( ( resolve ) => {
        const prevPromptText = $( "#input-line .prompt" ).text();
        $( "#input-line .prompt" ).text( promptText );
        term.removeCmdLineListeners();
        cmdLine_.addEventListener( "keydown", promptSubmitted );
        function promptSubmitted( e ) {
            if ( e.keyCode === 13 ) {
                cmdLine_.removeEventListener( "keydown", promptSubmitted );
                term.addCmdLineListeners();
                $( "#input-line .prompt" ).text( prevPromptText );
                resolve( this.value.trim() );
            }
        }
    } );
}

/**
 * List only details about programs the current user has access on the current server.
 */
function allowedSoftwares() {
    const softwares = {};
    for ( const app in softwareInfo ) {
        const program = softwareInfo[ app ];
        if ( program === null ) {
            softwares[ app ] = null;
        } else if (
            ( !program.location || program.location.includes( serverDatabase.serverAddress ) ) &&
            ( !program.protection || program.protection.includes( userDatabase.userId ) )
        ) {
            softwares[ app ] = program;
        }
    }
    return softwares;
}

/*
 * Wrapper to easily define sofwtare programs that act as dweets.
 * Reference code: https://github.com/lionleaf/dwitter/blob/master/dwitter/templates/dweet/dweet.html#L250
 * Notable difference with https://dwitter.net : default canvas dimensions are width=200 & height=200
 * There are usage examples in config/software.js
 */
const FPS = 60;
const epsilon = 1.5;
/* eslint-disable no-unused-vars */
const C = Math.cos;
const S = Math.sin;
const T = Math.tan;

let lastDweetId = 0;
function dweet( u, width, height, delay, style ) {
    width = width || 200;
    height = height || 200;
    delay = delay || 0;
    style = style || "";
    const id = ++lastDweetId;
    let frame = 0;
    let nextFrameMs = 0;
    function loop( frameTime ) {
        frameTime = frameTime || 0;
        const c = document.getElementById( id );
        if ( !c ) {
            console.log( `Stopping dweet rendering: no element with id=${ id } found` );
            return;
        }
        requestAnimationFrame( loop );
        if ( frameTime < nextFrameMs - epsilon ) {
            return; // Skip this cycle as we are animating too quickly.
        }
        nextFrameMs = Math.max( nextFrameMs + 1000 / FPS, frameTime );
        let time = frame / FPS;
        if ( time * FPS | frame - 1 === 0 ) {
            time += 0.000001;
        }
        frame++;
        const x = c.getContext( "2d" );
        x.fillStyle = "white";
        x.strokeStyle = "white";
        x.beginPath();
        x.resetTransform();
        x.clearRect( 0, 0, width, height ); // clear canvas
        u( time, x, c );
    }
    setTimeout( loop, delay + 50 ); // Minimal small delay to let time for the canvas to be inserted
    return `<canvas id="${ id }" width="${ width }" height="${ height }" style="${ style }">`;
}

function R( r, g, b, a ) {
    a = typeof a === "undefined" ? 1 : a;
    return `rgba(${ r | 0 },${ g | 0 },${ b | 0 },${ a })`;
}
