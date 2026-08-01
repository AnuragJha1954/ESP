const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendApprovalEmail = async (userEmail, name, generatedUsername, generatedPassword) => {
    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #ffffff; -webkit-font-smoothing: antialiased; }
            .wrapper { width: 100%; background-color: #000000; padding: 40px 0; }
            .container { max-width: 600px; margin: 0 auto; background-color: #0a0a0a; border-radius: 16px; border: 1px solid #222; overflow: hidden; box-shadow: 0 0 40px rgba(124, 58, 237, 0.1); }
            .header { padding: 40px 40px 20px 40px; text-align: center; }
            .logo { width: 70px; height: 70px; object-fit: contain; }
            .sub-logo-text { margin-top: 10px; font-size: 18px; font-weight: 600; background: linear-gradient(135deg, #a855f7 0%, #3b82f6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; color: #a855f7; letter-spacing: 0.5px; }
            .hero-image { width: 100%; max-height: 200px; object-fit: cover; border-top: 1px solid #222; border-bottom: 1px solid #222; display: block; }
            .content { padding: 40px; }
            .main-welcome { margin: 0 0 15px 0; font-size: 32px; font-weight: 700; color: #ffffff; }
            .greeting { font-size: 18px; margin-bottom: 15px; color: #a855f7; font-weight: 500; }
            .text { font-size: 15px; line-height: 1.6; color: #a1a1aa; margin-bottom: 25px; }
            
            .credentials-box { 
                background-color: #111111; 
                border: 1px solid #333; 
                border-radius: 12px; 
                padding: 24px; 
                margin: 30px 0; 
                text-align: center;
                border-top: 3px solid #7c3aed;
            }
            .cred-row { margin: 12px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
            .cred-value { display: block; font-family: 'Courier New', Courier, monospace; font-size: 22px; color: #ffffff; margin-top: 5px; font-weight: bold; letter-spacing: 2px; }
            
            .steps-container { background: #111111; border-radius: 12px; padding: 25px; margin-top: 30px; border: 1px solid #222; }
            .steps-title { color: #ffffff; font-size: 16px; margin: 0 0 15px 0; display: flex; align-items: center; }
            .broker-title { color: #a855f7; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px 0; font-weight: 600; }
            .step-list { margin: 0; padding-left: 15px; color: #a1a1aa; font-size: 14px; line-height: 1.7; }
            .step-list li { margin-bottom: 8px; }
            code { background: #000; padding: 3px 6px; border-radius: 4px; color: #3b82f6; font-size: 13px; font-family: monospace; border: 1px solid #222; }
            
            .btn-container { text-align: center; margin-top: 40px; }
            .btn { display: inline-block; padding: 14px 36px; background: linear-gradient(135deg, #7c3aed 0%, #2563eb 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3); }
            
            .footer { padding: 30px; text-align: center; font-size: 12px; color: #555; background: #050505; border-top: 1px solid #111; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="container">
                <div class="header">
                    <img src="https://tradopad.infirow.in/logo.png" alt="Infirow Logo" class="logo" />
                    <div class="sub-logo-text">Infirow Tradopad</div>
                </div>
                
                <img src="https://tradopad.infirow.in/email_graphic.jpg" alt="Futuristic Trading Terminal" class="hero-image" />
                
                <div class="content">
                    <h1 class="main-welcome">Welcome,</h1>
                    <div class="greeting">${name}</div>
                    <div class="text">Your request has been officially approved. You now have exclusive access to the ultimate automated trading terminal environment. Below are your newly provisioned credentials.</div>
                    
                    <div class="credentials-box">
                        <div class="cred-row">
                            System Username
                            <span class="cred-value">${generatedUsername}</span>
                        </div>
                        <div style="height: 1px; background: #222; margin: 15px 40px;"></div>
                        <div class="cred-row">
                            Access Password
                            <span class="cred-value">${generatedPassword}</span>
                        </div>
                    </div>

                    <div class="steps-container">
                        <h3 class="steps-title">Terminal Initialization Steps</h3>
                        <div class="text" style="margin-bottom: 10px; font-size: 13px;">To activate the hardware terminal, you must securely link your broker API keys inside the web application profile.</div>
                        
                        <div class="broker-title">Integration: Fyers</div>
                        <ol class="step-list" style="padding-left: 20px;">
                            <li>Log into the <a href="https://myapi.fyers.in/dashboard" style="color:#3b82f6; text-decoration:none;">Fyers API Dashboard</a>.</li>
                            <li>Click <b>Create App</b> and fill in your details.</li>
                            <li>For the <b>Redirect URL</b>, you MUST use exactly:<br/><code>https://trade.fyers.in/api-login/redirect-uri/index.html</code></li>
                            <li>Once created, copy the generated <b>App ID</b> and <b>Secret Key</b>.</li>
                            <li>Log into Tradopad, go to <b>Profile</b>, and paste them into the Fyers section.</li>
                        </ol>

                        <div class="broker-title" style="margin-top: 25px;">Integration: Dhan</div>
                        <ol class="step-list" style="padding-left: 20px;">
                            <li>Log into the <a href="https://web.dhan.co" style="color:#3b82f6; text-decoration:none;">Dhan Web Platform</a>.</li>
                            <li>Click on your profile icon and select <b>Access DhanHQ APIs</b>.</li>
                            <li>Under the API settings, enable <b>TOTP Authentication</b>.</li>
                            <li>Dhan will show a <b>TOTP Secret Key</b> (a long text code) — copy this carefully!</li>
                            <li>Log into Tradopad, go to <b>Profile</b>, and paste your <b>Client ID</b>, normal Dhan <b>Password</b>, and the <b>TOTP Secret</b> into the Dhan section.</li>
                        </ol>
                    </div>

                    <div class="btn-container">
                        <a href="https://tradopad.infirow.in" class="btn" style="color: #ffffff;">Initialize Terminal</a>
                    </div>
                </div>
                <div class="footer">
                    &copy; 2026 Infirow Technologies. All systems operational.
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    const mailOptions = {
        from: '"Infirow Tradopad" <work.infirow@gmail.com>',
        to: userEmail,
        subject: 'Your Tradopad Waitlist Request is Approved! 🚀',
        html: htmlTemplate
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Approval email sent: ' + info.response);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

module.exports = {
    sendApprovalEmail
};
