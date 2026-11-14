/* Site settings. After deploying ContactForm.gs as a web app, paste its URL between the quotes below. */
window.VSG_FORM_URL = 'https://script.google.com/macros/s/AKfycbw5gQNKak19nvs0ycre35Yj3T40l5BeSMFO9r4B4ecwaxEBi0SZYTeryL8_nTfMmeTV/exec';

/* Called when the contact form passes validation. Returns the confirmation text to show. */
window.vsgSubmit = function (s) {
  var fields = {
    first: s.fn.trim(), last: s.ln.trim(), email: s.em.trim(), btype: s.btype || '',
    services: s.svc.join(', '), message: s.msg.trim(), consent: 'yes'
  };
  if (window.VSG_FORM_URL) {
    try {
      fetch(window.VSG_FORM_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(fields) });
    } catch (e) { /* the request is fire-and-forget */ }
    return 'Your request was sent. We will reply to your email soon.';
  }
  var body = 'Name: ' + fields.first + ' ' + fields.last + '\nEmail: ' + fields.email +
    '\nBusiness type: ' + (fields.btype || '-') + '\nServices: ' + (fields.services || '-') + '\n\n' + fields.message;
  window.location.href = 'mailto:inquiry@vistasolaresgroup.com?subject=' +
    encodeURIComponent('Inquiry from ' + fields.first) + '&body=' + encodeURIComponent(body);
  return 'Your email app is opening with your message ready. Press Send there to deliver it.';
};
