const nodemailer = require('nodemailer');

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Uber Clone <${process.env.EMAIL_FROM}>`;
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
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: `<h1>Hello ${this.firstName}</h1><p>This is a ${template} email.</p>`,
      mailSettings: {
        sandboxMode: {
          enable: process.env.NODE_ENV !== 'production',
        },
      },
    };

    await this.newTransporter().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to Uber Clone');
  }
};
