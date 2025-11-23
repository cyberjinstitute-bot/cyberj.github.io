document.addEventListener('DOMContentLoaded', function () {
	/* ============================================
	   THEME TOGGLE (Light/Dark Mode)
	   ============================================ */
	
	// Check for saved theme preference or default to 'dark'
	var currentTheme = localStorage.getItem('theme') || 'dark';
	if (currentTheme === 'light') {
		document.body.classList.add('light-mode');
	}
	
	// Create theme toggle button if it doesn't exist
	if (!document.querySelector('.theme-toggle')) {
		var themeToggle = document.createElement('button');
		themeToggle.className = 'theme-toggle';
		themeToggle.setAttribute('aria-label', 'Toggle theme');
		themeToggle.innerHTML = currentTheme === 'light' ? '🌙' : '☀️';
		document.body.appendChild(themeToggle);
		
		themeToggle.addEventListener('click', function() {
			document.body.classList.toggle('light-mode');
			var isLight = document.body.classList.contains('light-mode');
			localStorage.setItem('theme', isLight ? 'light' : 'dark');
			themeToggle.innerHTML = isLight ? '🌙' : '☀️';
		});
	}
	
	/* ============================================
	   NAV TOGGLE
	   ============================================ */
	var toggle = document.querySelector('.nav-toggle');
	if (!toggle) return;

	toggle.addEventListener('click', function () {
		var expanded = this.getAttribute('aria-expanded') === 'true';
		this.setAttribute('aria-expanded', (!expanded).toString());
		document.body.classList.toggle('nav-open');
	});

	window.addEventListener('resize', function () {
		if (window.innerWidth > 768) {
			document.body.classList.remove('nav-open');
			toggle.setAttribute('aria-expanded', 'false');
		}
	});

	/* FAQ accordion behavior */
	var faqButtons = document.querySelectorAll('.faq-question');

	if (faqButtons && faqButtons.length) {
		faqButtons.forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				var parent = btn.closest('.faq-item');
				var panelId = btn.getAttribute('aria-controls');
				var panel = document.getElementById(panelId);
				var expanded = btn.getAttribute('aria-expanded') === 'true';

				// toggle aria attributes
				btn.setAttribute('aria-expanded', (!expanded).toString());
				if (panel) panel.setAttribute('aria-hidden', expanded ? 'true' : 'false');

				// toggle visual open state
				if (parent) {
					parent.classList.toggle('open');
					if (!expanded && panel) {
						// expand: set max-height to scrollHeight for transition
						panel.style.maxHeight = panel.scrollHeight + 'px';
					} else if (panel) {
						// collapse
						panel.style.maxHeight = null;
					}
				}
			});
			
			// allow keyboard activation (Enter/Space) — button already handles this by default
		});

		// Ensure panels with .open at load are sized correctly
		document.querySelectorAll('.faq-item.open .faq-answer').forEach(function(p) {
			p.style.maxHeight = p.scrollHeight + 'px';
		});
	}

	/* Booking location step behavior */
	var locationInputs = document.querySelectorAll('input[name="location"]');
	var locationNote = document.querySelector('.location-note');

	if (locationInputs && locationInputs.length && locationNote) {
		function updateLocationNote(value) {
			switch (value) {
				case 'domicile':
					locationNote.textContent = 'Intervention à domicile — frais variables selon la zone.';
					break;
				case 'atelier':
					locationNote.textContent = 'Intervention à l\'atelier — apportez votre appareil à l\'adresse indiquée.';
					break;
				case 'online':
					locationNote.textContent = 'Session en ligne — disponible pour les formations uniquement.';
					break;
				default:
					locationNote.textContent = 'Choisissez votre option de lieu.';
			}
		}

		locationInputs.forEach(function(inp){
			inp.addEventListener('change', function(e){
				updateLocationNote(e.target.value);
			});
		});

		// initialize note based on checked input
		var checked = document.querySelector('input[name="location"]:checked');
		if (checked) updateLocationNote(checked.value);
	}

	/* Step 3: calendar + timeslot picker */
	(function(){
		var calendarEl = document.querySelector('.calendar');
		var slotsEl = document.querySelector('.slots');
		var summaryEl = document.querySelector('.booking-summary');
		if (!calendarEl || !slotsEl) return;

		// simple deterministic mock availability generator for next 21 days
		function generateAvailability(daysCount){
			var avail = {};
			var now = new Date();
			for (var i=0;i<daysCount;i++){
				var d = new Date(now.getFullYear(), now.getMonth(), now.getDate()+i);
				var iso = d.toISOString().slice(0,10);
				var slots = [];
				for (var h=9; h<=17; h++){
					var time = (h<10? '0'+h : h) + ':00';
					// deterministic availability: hash of date+hour
					var n = d.getDate() + h;
					var available = (n % 3) !== 0; // ~2/3 available
					slots.push({time: time, available: available});
				}
				avail[iso] = slots;
			}
			return avail;
		}

		var availability = generateAvailability(21);

		// render calendar (simple list of dates)
		function renderCalendar(){
			calendarEl.innerHTML = '';
			Object.keys(availability).forEach(function(dateStr){
				var d = new Date(dateStr + 'T00:00:00');
				var btn = document.createElement('button');
				btn.className = 'date-btn small';
				btn.setAttribute('data-date', dateStr);
				btn.setAttribute('role','gridcell');
				btn.title = dateStr;
				btn.innerHTML = d.getDate() + '<br><span style="font-weight:600; font-size:0.8rem">' + d.toLocaleDateString('fr-FR',{weekday:'short'}) + '</span>';

				// mark available if at least one slot available
				var slots = availability[dateStr] || [];
				var anyAvailable = slots.some(function(s){ return s.available; });
				if (anyAvailable) btn.classList.add('available'); else btn.classList.add('booked','disabled');

				btn.addEventListener('click', function(){
					if (btn.classList.contains('disabled')) return;
					selectDate(dateStr, btn);
				});

				calendarEl.appendChild(btn);
			});
		}

		var selectedDate = null;
		var selectedTime = null;

		function selectDate(dateStr, btn){
			// visual
			calendarEl.querySelectorAll('.date-btn').forEach(function(b){ b.classList.remove('selected'); });
			btn.classList.add('selected');
			selectedDate = dateStr;
			renderSlots(dateStr);
		}

		function renderSlots(dateStr){
			slotsEl.innerHTML = '';
			var slots = availability[dateStr] || [];
			slots.forEach(function(s){
				var sp = document.createElement('button');
				sp.className = 'slot ' + (s.available ? 'available' : 'booked');
				sp.textContent = s.time + (s.available ? ' — Disponible' : ' — Occupé');
				sp.setAttribute('data-time', s.time);
				sp.disabled = !s.available;
				sp.addEventListener('click', function(){
					selectedTime = s.time;
					updateSummary();
					// highlight selection
					slotsEl.querySelectorAll('.slot').forEach(function(x){ x.classList.remove('chosen'); });
					sp.classList.add('chosen');
				});
				slotsEl.appendChild(sp);
			});
			if (slots.length===0) slotsEl.innerHTML = '<p class="muted">Aucun créneau disponible pour cette date.</p>';
		}

		function updateSummary(){
			if (selectedDate && selectedTime) {
				summaryEl.textContent = 'Creneau choisi: ' + selectedDate + ' à ' + selectedTime;
			} else {
				summaryEl.textContent = 'Aucun créneau sélectionné.';
			}
		}

		renderCalendar();

	})();

	/* Booking service card toggles */
	var serviceToggles = document.querySelectorAll('.service-toggle');

	if (serviceToggles && serviceToggles.length) {
		serviceToggles.forEach(function(btn){
			btn.addEventListener('click', function(){
				var parent = btn.closest('.service-card');
				var panelId = btn.getAttribute('aria-controls');
				var panel = document.getElementById(panelId);

				// Close other open cards (single-open behavior)
				document.querySelectorAll('.service-card.open').forEach(function(openCard){
					if (openCard !== parent) {
						openCard.classList.remove('open');
						var otherPanel = openCard.querySelector('.service-options');
						var otherBtn = openCard.querySelector('.service-toggle');
						if (otherPanel) otherPanel.style.maxHeight = null;
						if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
						if (otherPanel) otherPanel.setAttribute('aria-hidden', 'true');
					}
				});

				var expanded = btn.getAttribute('aria-expanded') === 'true';
				btn.setAttribute('aria-expanded', (!expanded).toString());
				if (panel) panel.setAttribute('aria-hidden', expanded ? 'true' : 'false');

				if (parent) {
					parent.classList.toggle('open');
					if (!expanded && panel) {
						panel.style.maxHeight = panel.scrollHeight + 'px';
					} else if (panel) {
						panel.style.maxHeight = null;
					}
				}
			});
		});
	}

	/* Service item selection inside dropdowns */
	(function(){
		var svcItems = document.querySelectorAll('.service-options li');
		var selectedService = null;
		if (!svcItems || !svcItems.length) return;

		svcItems.forEach(function(li){
			li.style.cursor = 'pointer';
			li.addEventListener('click', function(){
				// remove other selections
				document.querySelectorAll('.service-options li.svc-chosen').forEach(function(x){ x.classList.remove('svc-chosen'); });
				li.classList.add('svc-chosen');
				// store selected service details
				var parentCard = li.closest('.service-card');
				var category = parentCard ? parentCard.getAttribute('data-service') : '';
				var titleEl = li.querySelector('strong');
				var title = titleEl ? titleEl.textContent.trim() : li.textContent.trim();
				var parts = li.textContent.split('—');
				var price = parts.length>1 ? parts[1].trim() : '';
				selectedService = { category: category, title: title, price: price };
				// update a small inline indicator (optional)
				if (parentCard) parentCard.classList.add('has-selection');
			});
		});
		// expose selectedService via closure accessor
		window.__selectedService = function(){ return selectedService; };
	})();

	/* Booking form validation and behavior (Step 4) -> shows Step 5 summary */
	(function(){
		var form = document.getElementById('booking-form');
		if (!form) return;

		var addressField = document.querySelector('.address-field');
		var adresseInput = document.getElementById('adresse');
		var locationRadios = document.querySelectorAll('input[name="location"]');
		var errorEl = form.querySelector('.form-error');
		var confirmSection = document.querySelector('.booking-confirmation');
		var confirmError = document.getElementById('confirm-error');

		function updateAddressVisibility() {
			var checked = document.querySelector('input[name="location"]:checked');
			if (checked && checked.value === 'domicile') {
				if (addressField) addressField.style.display = 'block';
				adresseInput.setAttribute('required','required');
				adresseInput.setAttribute('aria-required','true');
			} else {
				if (addressField) addressField.style.display = 'none';
				adresseInput.removeAttribute('required');
				adresseInput.removeAttribute('aria-required');
			}
		}

		locationRadios.forEach(function(r){ r.addEventListener('change', updateAddressVisibility); });
		updateAddressVisibility();

		function gatherSummary() {
			// service
			var svc = window.__selectedService ? window.__selectedService() : null;
			var serviceLabel = '—';
			var priceLabel = '—';
			if (svc && svc.title) {
				serviceLabel = svc.title;
				priceLabel = svc.price || 'À définir';
			} else {
				var selCard = document.querySelector('.service-card.has-selection') || document.querySelector('.service-card.open');
				if (selCard) {
					var btn = selCard.querySelector('.service-toggle');
					serviceLabel = btn ? btn.textContent.trim() : selCard.getAttribute('data-service');
				}
			}

			// date/time
			var dateBtn = document.querySelector('.date-btn.selected');
			var date = dateBtn ? dateBtn.getAttribute('data-date') : '';
			var chosen = document.querySelector('.slots .chosen');
			var time = chosen ? chosen.getAttribute('data-time') : '';

			// location
			var locChecked = document.querySelector('input[name="location"]:checked');
			var locationText = locChecked ? locChecked.parentNode.textContent.trim() : '';
			if (locChecked && locChecked.value === 'domicile') {
				var addr = document.getElementById('adresse').value.trim();
				if (addr) locationText += ' — ' + addr;
			}

			// contact
			var nom = form.nom.value.trim();
			var prenom = form.prenom.value.trim();
			var email = form.email.value.trim();
			var tel = form.tel.value.trim();

			return {
				service: serviceLabel,
				price: priceLabel,
				datetime: (date && time) ? (date + ' à ' + time) : '—',
				location: locationText || '—',
				contact: (prenom || nom) ? (prenom + ' ' + nom + ' • ' + email + ' • ' + tel) : '—'
			};
		}

		form.addEventListener('submit', function(e){
			e.preventDefault();
			if (errorEl) { errorEl.classList.add('visually-hidden'); errorEl.textContent = ''; }

			// basic validation
			var nom = form.nom.value.trim();
			var prenom = form.prenom.value.trim();
			var email = form.email.value.trim();
			var tel = form.tel.value.trim();

			if (!nom || !prenom || !email || !tel) {
				if (errorEl) { errorEl.textContent = 'Veuillez compléter les champs obligatoires (*)'; errorEl.classList.remove('visually-hidden'); }
				return;
			}

			// ensure a slot chosen
			var chosen = document.querySelector('.slots .chosen');
			if (!chosen) {
				if (errorEl) { errorEl.textContent = 'Veuillez sélectionner un créneau (Étape 3) avant de continuer.'; errorEl.classList.remove('visually-hidden'); }
				return;
			}

			// simple email format check
			var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
			if (!emailOk) {
				if (errorEl) { errorEl.textContent = 'Adresse email invalide.'; errorEl.classList.remove('visually-hidden'); }
				return;
			}

			// populate confirmation section
			var data = gatherSummary();
			document.getElementById('summary-service').textContent = data.service;
			document.getElementById('summary-datetime').textContent = data.datetime;
			document.getElementById('summary-location').textContent = data.location;
			document.getElementById('summary-price').textContent = data.price;
			document.getElementById('summary-contact').textContent = data.contact;

			// show confirmation
			if (confirmSection) {
				confirmSection.classList.remove('visually-hidden');
				confirmSection.classList.add('show');
				confirmSection.scrollIntoView({behavior:'smooth'});
			}
		});

		// edit button
		document.getElementById('edit-booking').addEventListener('click', function(){
			if (confirmSection) { confirmSection.classList.add('visually-hidden'); confirmSection.classList.remove('show'); }
			window.scrollTo({ top: 0, behavior: 'smooth' });
		});

		// final confirm button
		document.getElementById('confirm-booking-button').addEventListener('click', function(){
			var accept = document.getElementById('accept-cgv');
			var subscribe = document.getElementById('subscribe-offers');
			if (confirmError) { confirmError.classList.add('visually-hidden'); confirmError.textContent = ''; }
			if (!accept || !accept.checked) {
				if (confirmError) { confirmError.textContent = 'Vous devez accepter les CGV pour confirmer.'; confirmError.classList.remove('visually-hidden'); }
				return;
			}

			// collect booking data and redirect to confirmation page
			var btn = this;
			btn.disabled = true;
			var booking = {};
			booking.service = document.getElementById('summary-service') ? document.getElementById('summary-service').textContent : '';
			booking.datetime = document.getElementById('summary-datetime') ? document.getElementById('summary-datetime').textContent : '';
			booking.location = document.getElementById('summary-location') ? document.getElementById('summary-location').textContent : '';
			booking.price = document.getElementById('summary-price') ? document.getElementById('summary-price').textContent : '';
			booking.contact = document.getElementById('summary-contact') ? document.getElementById('summary-contact').textContent : '';
			booking.subscribe = document.getElementById('subscribe-offers') ? document.getElementById('subscribe-offers').checked : false;

			try {
				sessionStorage.setItem('lastBooking', JSON.stringify(booking));
				// redirect to confirmation page
				window.location.href = 'reservation-confirmation.html';
			} catch (err) {
				var success = document.getElementById('confirm-success');
				if (success) {
					success.classList.remove('visually-hidden');
					success.textContent = 'Réservation confirmée. Merci — un email de confirmation vous sera envoyé.';
				}
			}

			// Here you'd POST the data to your server/API
		});

	})();

	/* Alternative: contact booking form handler */
	(function(){
		var cbForm = document.getElementById('contact-booking-form');
		if (!cbForm) return;
		var resultEl = document.getElementById('cb-result');

		cbForm.addEventListener('submit', function(e){
			e.preventDefault();
			var nom = cbForm['nom'].value.trim();
			var email = cbForm['email'].value.trim();
			var tel = cbForm['tel'].value.trim();
			if (!nom || !email || !tel) {
				if (resultEl) resultEl.textContent = 'Veuillez remplir les champs obligatoires.';
				return;
			}

			var payload = {
				service: cbForm['service'].value,
				date: cbForm['date'].value,
				pref: (cbForm.querySelector('input[name="pref-time"]:checked')||{}).value || '',
				message: cbForm['message'].value,
				nom: nom,
				email: email,
				tel: tel
			};

		// store in sessionStorage as a simple log and show user feedback
		try { sessionStorage.setItem('contactBooking', JSON.stringify(payload)); } catch (err) {}
		if (resultEl) resultEl.textContent = 'Merci — Nous vous recontacterons sous 2h pour confirmer le rendez-vous.';
		cbForm.querySelector('button[type="submit"]').disabled = true;
	});
})();

/* Contact page form handler */
(function(){
	var contactForm = document.getElementById('contact-form');
	if (!contactForm) return;
	var errorEl = contactForm.querySelector('.form-error');
	var successEl = contactForm.querySelector('.form-success');

	contactForm.addEventListener('submit', function(e){
		e.preventDefault();
		if (errorEl) { errorEl.classList.add('visually-hidden'); errorEl.textContent = ''; }
		if (successEl) { successEl.classList.add('visually-hidden'); successEl.textContent = ''; }

		// validation
		var nom = contactForm['nom'].value.trim();
		var prenom = contactForm['prenom'].value.trim();
		var email = contactForm['email'].value.trim();
		var tel = contactForm['tel'].value.trim();
		var sujet = contactForm['sujet'].value;
		var message = contactForm['message'].value.trim();
		var consent = contactForm['consent'].checked;

		if (!nom || !prenom || !email || !tel || !sujet || !message) {
			if (errorEl) { errorEl.textContent = 'Veuillez remplir tous les champs obligatoires (*)'; errorEl.classList.remove('visually-hidden'); }
			return;
		}

		// simple email format check
		var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
		if (!emailOk) {
			if (errorEl) { errorEl.textContent = 'Adresse email invalide.'; errorEl.classList.remove('visually-hidden'); }
			return;
		}

		if (!consent) {
			if (errorEl) { errorEl.textContent = 'Vous devez accepter d\'être contacté pour envoyer ce message.'; errorEl.classList.remove('visually-hidden'); }
			return;
		}

		var payload = {
			nom: nom,
			prenom: prenom,
			email: email,
			tel: tel,
			sujet: sujet,
			message: message,
			consent: consent
		};

		// store in sessionStorage as a simple log
		try { sessionStorage.setItem('lastContactForm', JSON.stringify(payload)); } catch (err) {}

		// Show success message
		if (successEl) {
			successEl.textContent = 'Merci ! Votre message a été envoyé. Nous vous répondrons sous 2 heures.';
			successEl.classList.remove('visually-hidden');
		}

		// disable submit button
		contactForm.querySelector('button[type="submit"]').disabled = true;

		// Here you'd POST the data to your server/API
		// Example: fetch('/api/contact', { method: 'POST', body: JSON.stringify(payload), headers: {'Content-Type': 'application/json'} })
	});
})();

});