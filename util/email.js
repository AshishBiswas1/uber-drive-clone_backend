const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Uber Clone <${process.env.EMAIL_FROM}>`;
    this.userType = user.role || 'rider';
  }

  newTransporter() {
    return nodemailer.createTransport({
      service: 'SendGrid',
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  async send(template, subject) {
    const html = pug.renderFile(
      `${__dirname}/../views/emails/${template}.pug`,
      {
        fileName: this.firstName,
        url: this.url,
        subject,
        userType: this.userType,
      }
    );

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html, {
        wordwrap: 130,
        preserveNewlines: true,
      }),
      mailSettings: {
        sandboxMode: {
          enable: process.env.NODE_ENV === 'development',
        },
      },
    };

    await this.newTransporter().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to Uber Clone');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Your password reset token (valid for only 10 minutes)'
    );
  }

  async sendPasswordResetSuccess() {
    await this.send(
      'passwordResetSuccess',
      'Password Reset Successful - Uber Clone'
    );
  }
};
