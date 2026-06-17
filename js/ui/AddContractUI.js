// ============================================================
//  AddContractUI — SRP: รับผิดชอบเฉพาะ Add/Edit Contract form
//  GRASP: Creator — สร้าง EmailTagInput instances (มี data ที่ต้องการ)
//  DIP: รับ ContractService, ToastUI, router เป็น dependencies
// ============================================================

class AddContractUI {
  /**
   * @param {ContractService} contractService
   * @param {EmailHistoryService} historyService
   * @param {ToastUI} toast
   * @param {Function} getContracts - () => contract[] (getter ปัจจุบัน)
   * @param {Function} onContractAdded - callback(newContract) หลัง save สำเร็จ
   * @param {Function} navigateTo - router.navigateTo
   */
  constructor(contractService, historyService, toast, getContracts, onContractAdded, navigateTo) {
    this._service       = contractService;
    this._history       = historyService;
    this._toast         = toast;
    this._getContracts  = getContracts;
    this._onAdded       = onContractAdded;
    this._navigate      = navigateTo;

    this._customAlertDays = [];
    this._form = document.getElementById('contractForm');

    // ── Edit mode state ──────────────────────────────────
    this._editMode = false;
    this._editContractId = null;
    this._onUpdated = null; // set via setOnUpdated()

    // GRASP: Creator — AddContractUI เป็นผู้สร้าง EmailTagInput
    this._saleEmailTags = new EmailTagInput(
      'saleTagContainer', 'saleTags', 'saleEmailInput', 'saleDropdown',
      this._history,
      () => this._history.collectAll(this._getContracts()),
      () => this._renderRecentEmails()
    );
    this._engEmailTags = new EmailTagInput(
      'engTagContainer', 'engTags', 'engEmailInput', 'engDropdown',
      this._history,
      () => this._history.collectAll(this._getContracts()),
      () => this._renderRecentEmails()
    );

    this._bindDurationPreview();
    this._bindCustomAlertDays();
    this._bindFormSubmit();
    this._bindActionButtons();
    this._bindLineMessageParser();
    this._renderRecentEmails();
    this._renderLineGroupSelector();

    document.getElementById('lineGroupId')?.addEventListener('input', () => {
      this._syncLineGroupActiveChip();
    });
  }

  // ── Public ────────────────────────────────────────────────

  refreshRecentEmails() { 
    this._renderRecentEmails(); 
    this._renderLineGroupSelector();
  }

  /**
   * Set callback for when a contract is updated (edit mode)
   * @param {Function} callback - (contractId, updatedData) => void
   */
  setOnUpdated(callback) { this._onUpdated = callback; }

  /**
   * Enter edit mode: populate form with existing contract data
   * @param {Object} contract - existing contract to edit
   */
  enterEditMode(contract) {
    this._editMode = true;
    this._editContractId = contract.contract_id;

    // Update page heading
    const heading = document.getElementById('heading-add-contract');
    if (heading) heading.textContent = '✏️ แก้ไขสัญญา MA/PM';

    // Update submit button
    const submitBtn = this._form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        บันทึกการแก้ไข
      `;
    }

    // Show edit info banner
    this._showEditBanner(contract);

    // Populate form fields
    document.getElementById('poNumber').value = contract.po_number || '';
    document.getElementById('projectName').value = contract.project_name || '';
    document.getElementById('customerName').value = contract.customer_name || '';
    document.getElementById('serviceType').value = contract.service_type || '';
    document.getElementById('startDate').value = contract.start_date || '';
    document.getElementById('endDate').value = contract.end_date || '';
    document.getElementById('teamsWebhook').value = contract.teams_webhook || '';
    document.getElementById('lineGroupId').value = contract.line_group_id || '';
    document.getElementById('contractNote').value = contract.note || '';

    // Populate email tags
    this._saleEmailTags.clear();
    this._engEmailTags.clear();
    if (contract.recipients_sale) {
      contract.recipients_sale.split(',').filter(e => e.trim()).forEach(e => this._saleEmailTags.addEmail(e.trim()));
    }
    if (contract.recipients_eng) {
      contract.recipients_eng.split(',').filter(e => e.trim()).forEach(e => this._engEmailTags.addEmail(e.trim()));
    }

    // Trigger duration preview
    const startInput = document.getElementById('startDate');
    const endInput = document.getElementById('endDate');
    if (startInput && endInput) {
      startInput.dispatchEvent(new Event('change'));
    }

    this._renderRecentEmails();
    this._syncLineGroupActiveChip();
  }

  /**
   * Exit edit mode and reset form to "add new" state
   */
  exitEditMode() {
    this._editMode = false;
    this._editContractId = null;

    // Restore heading
    const heading = document.getElementById('heading-add-contract');
    if (heading) heading.textContent = '🔔 เพิ่มสัญญา MA/PM ใหม่';

    // Restore submit button
    const submitBtn = this._form.querySelector('[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
        </svg>
        บันทึกสัญญา
      `;
    }

    // Remove edit banner
    const banner = document.getElementById('editBanner');
    if (banner) banner.remove();

    this._resetForm();
  }

  // ── Private: Edit Banner ─────────────────────────────────

  _showEditBanner(contract) {
    // Remove existing banner
    const existing = document.getElementById('editBanner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'editBanner';
    banner.className = 'edit-banner';
    banner.innerHTML = `
      <div class="edit-banner-content">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        <span>กำลังแก้ไข: <strong>${contract.po_number}</strong> — ${contract.project_name}</span>
        <code style="font-size:0.7rem;opacity:0.7;margin-left:8px">${contract.contract_id}</code>
      </div>
      <button type="button" class="btn btn-sm btn-ghost edit-banner-cancel" id="btnCancelEdit">
        ✕ ยกเลิกการแก้ไข
      </button>
    `;

    // Insert before form
    this._form.parentNode.insertBefore(banner, this._form);

    document.getElementById('btnCancelEdit')?.addEventListener('click', () => {
      this.exitEditMode();
      this._navigate('contracts');
    });
  }

  // ── Private: Duration Preview ─────────────────────────────

  _bindDurationPreview() {
    const start = document.getElementById('startDate');
    const end = document.getElementById('endDate');
    const update = () => {
      if (start.value && end.value) {
        const diff = Math.ceil((new Date(end.value) - new Date(start.value)) / (1000 * 60 * 60 * 24));
        document.getElementById('durationText').textContent =
          diff === 0 ? 'ภายในวันเดียวกัน'
          : diff > 0 ? `${diff} วัน (${Math.round(diff / 30)} เดือน)`
          : 'วันที่ไม่ถูกต้อง';
      }
    };
    start.addEventListener('change', update);
    end.addEventListener('change', update);
  }

  // ── Private: Custom Alert Days ────────────────────────────

  _bindCustomAlertDays() {
    const addBtn = document.getElementById('addCustomAlert');
    const input  = document.getElementById('customAlertDays');

    addBtn?.addEventListener('click', () => this._addCustomAlertDay());
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._addCustomAlertDay(); }
    });
  }

  _addCustomAlertDay() {
    const input = document.getElementById('customAlertDays');
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0 || val > 365) {
      this._toast.error('❌ กรุณาระบุจำนวนวันระหว่าง 0–365');
      return;
    }
    const presetDays = [30, 14, 7, 1, 0];
    if (presetDays.includes(val) || this._customAlertDays.includes(val)) {
      this._toast.error(`⚠️ ${val} วัน มีอยู่แล้ว`);
      return;
    }
    this._customAlertDays.push(val);
    this._customAlertDays.sort((a, b) => b - a);
    this._renderCustomAlertTags();
    input.value = '';
    this._toast.success(`✅ เพิ่มแจ้งเตือนก่อน ${val} วัน`);
  }

  _renderCustomAlertTags() {
    const container = document.getElementById('customAlertTags');
    container.innerHTML = this._customAlertDays.map((days, i) => `
      <span class="custom-alert-tag">
        ${days} วัน
        <button type="button" class="tag-remove" data-index="${i}" title="ลบ">×</button>
      </span>
    `).join('');

    container.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this._customAlertDays.splice(parseInt(btn.dataset.index), 1);
        this._renderCustomAlertTags();
      });
    });
  }

  // ── Private: Recent Emails ────────────────────────────────

  _renderRecentEmails() {
    const chipsContainer = document.getElementById('recentEmailsChips');
    const allEmails = this._history.collectAll(this._getContracts());
    const allUsed = new Set([
      ...this._saleEmailTags.getEmails(),
      ...this._engEmailTags.getEmails(),
    ]);

    if (allEmails.length === 0) {
      chipsContainer.innerHTML = '<span style="font-size:0.78rem;color:var(--text-muted)">ยังไม่มี email ที่เคยใช้</span>';
      return;
    }

    chipsContainer.innerHTML = allEmails.slice(0, 15).map(email => {
      const isUsed = allUsed.has(email);
      return `
        <button class="recent-chip ${isUsed ? 'used' : ''}" data-email="${email}" type="button" title="${isUsed ? 'เพิ่มแล้ว' : 'คลิกเพื่อเพิ่ม'}">
          <span class="chip-avatar">${getInitials(email)}</span>
          <span>${email}</span>
          ${isUsed ? '' : '<span class="chip-add">+</span>'}
        </button>
      `;
    }).join('');

    chipsContainer.querySelectorAll('.recent-chip:not(.used)').forEach(chip => {
      chip.addEventListener('click', () => {
        this._showAddToFieldPopup(chip.dataset.email, chip);
      });
    });
  }

  _showAddToFieldPopup(email, anchorEl) {
    document.querySelectorAll('.field-picker-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'field-picker-popup';
    popup.innerHTML = `
      <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:6px;font-weight:600">เพิ่ม "${email}" ให้:</div>
      <button class="field-picker-btn" data-target="sale" type="button">📧 Email Sale</button>
      <button class="field-picker-btn" data-target="eng" type="button">🔧 Email Engineer</button>
      <button class="field-picker-btn" data-target="both" type="button">✅ ทั้ง Sale + Engineer</button>
    `;

    popup.style.cssText = `
      position:fixed;background:var(--bg-secondary);border:1px solid var(--border-color);
      border-radius:var(--radius-md);padding:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);
      z-index:100;min-width:200px;animation:dropIn 0.2s ease;
    `;

    const rect = anchorEl.getBoundingClientRect();
    popup.style.left = rect.left + 'px';
    popup.style.top  = (rect.bottom + 6) + 'px';
    document.body.appendChild(popup);

    popup.querySelectorAll('.field-picker-btn').forEach(btn => {
      btn.style.cssText = `
        display:block;width:100%;text-align:left;padding:8px 10px;background:transparent;
        border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);
        font-family:inherit;font-size:0.8rem;cursor:pointer;margin-bottom:4px;transition:all 0.15s ease;
      `;
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(59,130,246,0.1)'; btn.style.borderColor = 'var(--primary-500)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; btn.style.borderColor = 'var(--border-subtle)'; });
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target === 'sale' || target === 'both') this._saleEmailTags.addEmail(email);
        if (target === 'eng'  || target === 'both') this._engEmailTags.addEmail(email);
        popup.remove();
        this._renderRecentEmails();
      });
    });

    setTimeout(() => {
      const closeHandler = e => {
        if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', closeHandler); }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  // ── Private: Form Submit ──────────────────────────────────

  _bindFormSubmit() {
    this._form.addEventListener('submit', async e => {
      e.preventDefault();
      if (this._editMode) {
        await this._handleUpdate();
      } else {
        await this._handleSubmit();
      }
    });
  }

  // ── Handle UPDATE (edit mode) ─────────────────────────────

  async _handleUpdate() {
    const saleEmails = this._saleEmailTags.getEmails();
    const engEmails  = this._engEmailTags.getEmails();

    // Collect alert days
    const alertDays = [];
    ['alert30', 'alert14', 'alert7', 'alert1', 'alert0'].forEach(id => {
      const el = document.getElementById(id);
      if (el?.checked) alertDays.push(parseInt(el.value));
    });
    this._customAlertDays.forEach(d => { if (!alertDays.includes(d)) alertDays.push(d); });
    alertDays.sort((a, b) => b - a);

    const notifyTime = document.getElementById('notifyTime').value || '08:00';

    const updatedData = {
      po_number:       document.getElementById('poNumber').value.trim(),
      project_name:    document.getElementById('projectName').value.trim(),
      customer_name:   document.getElementById('customerName').value.trim(),
      service_type:    document.getElementById('serviceType').value,
      start_date:      document.getElementById('startDate').value,
      end_date:        document.getElementById('endDate').value,
      recipients_sale: saleEmails.join(','),
      recipients_eng:  engEmails.join(','),
      teams_webhook:   document.getElementById('teamsWebhook').value.trim(),
      note:            document.getElementById('contractNote').value.trim(),
      line_group_id:   document.getElementById('lineGroupId').value.trim(),
      alert_days:      alertDays,
      notify_time:     notifyTime,
      regenerate_rules: true, // ให้ backend สร้าง rules ใหม่
    };

    const submitBtn = this._form.querySelector('[type="submit"]');
    const originalHTML = submitBtn?.innerHTML;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังบันทึก...'; }

    try {
      if (this._service.isDemoMode()) {
        // Demo mode — update local only
        this._toast.warning('⚠️ อัพเดทเฉพาะ local session (demo mode)');
        if (this._onUpdated) {
          this._onUpdated(this._editContractId, {
            ...updatedData,
            contract_id: this._editContractId,
            status: 'active',
            notify_line: !!updatedData.line_group_id,
          });
        }
        this.exitEditMode();
        this._navigate('contracts');
        return;
      }

      const result = await this._service.updateContract(this._editContractId, updatedData);

      if (result.status === 'ok') {
        this._toast.success(`✅ อัพเดทสัญญา ${updatedData.po_number} เรียบร้อย`);
        if (this._onUpdated) {
          this._onUpdated(this._editContractId, {
            ...updatedData,
            contract_id: this._editContractId,
            status: 'active',
            notify_line: !!updatedData.line_group_id,
          });
        }
        this.exitEditMode();
        this._navigate('contracts');
      } else {
        this._toast.error(`❌ อัพเดทไม่สำเร็จ: ${result.message || 'ไม่ทราบสาเหตุ'}`);
      }
    } catch (err) {
      console.error('Update error:', err);
      this._toast.error(`❌ เชื่อมต่อไม่ได้: ${err.message}`);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalHTML; }
    }
  }

  // ── Handle CREATE (normal mode) ───────────────────────────

  async _handleSubmit() {
    const saleEmails = this._saleEmailTags.getEmails();
    const engEmails  = this._engEmailTags.getEmails();

    // Collect alert days
    const alertDays = [];
    ['alert30', 'alert14', 'alert7', 'alert1', 'alert0'].forEach(id => {
      const el = document.getElementById(id);
      if (el?.checked) alertDays.push(parseInt(el.value));
    });
    this._customAlertDays.forEach(d => { if (!alertDays.includes(d)) alertDays.push(d); });
    alertDays.sort((a, b) => b - a);

    const notifyTime = document.getElementById('notifyTime').value || '08:00';

    const newContract = {
      po_number:       document.getElementById('poNumber').value.trim(),
      project_name:    document.getElementById('projectName').value.trim(),
      customer_name:   document.getElementById('customerName').value.trim(),
      service_type:    document.getElementById('serviceType').value,
      start_date:      document.getElementById('startDate').value,
      end_date:        document.getElementById('endDate').value,
      recipients_sale: saleEmails.join(','),
      recipients_eng:  engEmails.join(','),
      teams_webhook:   document.getElementById('teamsWebhook').value.trim(),
      note:            document.getElementById('contractNote').value.trim(),
      line_group_id:   document.getElementById('lineGroupId').value.trim(),
      alert_days:      alertDays,
      notify_time:     notifyTime,
      created_by:      'dashboard',
    };

    const submitBtn = this._form.querySelector('[type="submit"]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '⏳ กำลังบันทึก...'; }

    try {
      // Demo mode — no GAS URL
      if (this._service.isDemoMode()) {
        this._toast.warning('⚠️ ยังไม่ได้ตั้งค่า GAS URL — บันทึกเฉพาะ local session (demo mode)');
        this._onAdded({ ...newContract, contract_id: generateId('WC'), status: 'active', notify_line: !!newContract.line_group_id });
        this._resetForm();
        this._navigate('contracts');
        return;
      }

      const result = await this._service.addContract(newContract);

      if (result.status === 'ok') {
        const channelSummary = [];
        if (saleEmails.length > 0 || engEmails.length > 0) channelSummary.push('📧 Email');
        if (newContract.teams_webhook) channelSummary.push('💬 Teams');
        if (newContract.line_group_id) channelSummary.push('💚 LINE');
        const channelText = channelSummary.length > 0 ? channelSummary.join(', ') : 'ไม่มีช่องทาง';

        this._toast.success(
          `✅ บันทึกสัญญา ${newContract.po_number} ลง Google Sheets เรียบร้อย — ` +
          `แจ้งเตือน ${alertDays.length > 0 ? alertDays.join(', ') + ' วัน' : 'ค่าเริ่มต้น'} ` +
          `⏰ ${notifyTime} น. (${channelText})`
        );

        this._onAdded({
          ...newContract,
          contract_id: result.contract_id || generateId('WC'),
          status: 'active',
          notify_line: !!newContract.line_group_id,
        });
        this._resetForm();
        this._navigate('contracts');
      } else {
        this._toast.error(`❌ เกิดข้อผิดพลาด: ${result.message || 'ไม่ทราบสาเหตุ'}`);
      }
    } catch (err) {
      console.error('GAS fetch error:', err);
      this._toast.error(`❌ เชื่อมต่อ Google Apps Script ไม่ได้: ${err.message}`);
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
    }
  }

  _resetForm() {
    this._form.reset();
    this._saleEmailTags.clear();
    this._engEmailTags.clear();
    this._customAlertDays.length = 0;
    this._renderCustomAlertTags();
    this._renderRecentEmails();
    this._syncLineGroupActiveChip();
  }

  // ── PRESET INTEGRATION ────────────────────────────────────

  getFormDataForPreset() {
    const saleEmails = this._saleEmailTags.getEmails();
    const engEmails  = this._engEmailTags.getEmails();
    
    const alertDays = [];
    ['alert30', 'alert14', 'alert7', 'alert1', 'alert0'].forEach(id => {
      const el = document.getElementById(id);
      if (el?.checked) alertDays.push(parseInt(el.value));
    });
    this._customAlertDays.forEach(d => { if (!alertDays.includes(d)) alertDays.push(d); });
    alertDays.sort((a, b) => b - a);

    return {
      customer_name:   document.getElementById('customerName').value.trim(),
      service_type:    document.getElementById('serviceType').value,
      recipients_sale: saleEmails.join(','),
      recipients_eng:  engEmails.join(','),
      teams_webhook:   document.getElementById('teamsWebhook').value.trim(),
      line_group_id:   document.getElementById('lineGroupId').value.trim(),
      alert_days:      alertDays,
      notify_time:     document.getElementById('notifyTime').value || '08:00',
      note:            document.getElementById('contractNote').value.trim(),
    };
  }

  fillFormWithPreset(presetData) {
    if (presetData.customer_name !== undefined) document.getElementById('customerName').value = presetData.customer_name;
    if (presetData.service_type !== undefined)  document.getElementById('serviceType').value = presetData.service_type;
    if (presetData.teams_webhook !== undefined) document.getElementById('teamsWebhook').value = presetData.teams_webhook;
    if (presetData.line_group_id !== undefined) document.getElementById('lineGroupId').value = presetData.line_group_id;
    if (presetData.notify_time !== undefined)   document.getElementById('notifyTime').value = presetData.notify_time;
    if (presetData.note !== undefined)          document.getElementById('contractNote').value = presetData.note;

    // Tags
    this._saleEmailTags.clear();
    if (presetData.recipients_sale) {
      presetData.recipients_sale.split(',').forEach(email => {
        if (email.trim()) this._saleEmailTags.addEmail(email.trim());
      });
    }

    this._engEmailTags.clear();
    if (presetData.recipients_eng) {
      presetData.recipients_eng.split(',').forEach(email => {
        if (email.trim()) this._engEmailTags.addEmail(email.trim());
      });
    }

    // Alert Days
    if (presetData.alert_days) {
      ['alert30', 'alert14', 'alert7', 'alert1', 'alert0'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = presetData.alert_days.includes(parseInt(el.value));
      });
      this._customAlertDays = presetData.alert_days.filter(d => ![30, 14, 7, 1, 0].includes(d));
      this._renderCustomAlertTags();
    }
    this._syncLineGroupActiveChip();
  }

  // ── Private: LINE Message Parser ──────────────────────────

  _bindLineMessageParser() {
    const header = document.getElementById('lineParserHeader');
    const body = document.getElementById('lineParserBody');
    const icon = document.getElementById('lineParserToggleIcon');
    const btnClear = document.getElementById('btnClearLineMessage');
    const btnParse = document.getElementById('btnParseLineMessage');
    const textarea = document.getElementById('lineRawMessage');

    header?.addEventListener('click', () => {
      if (body.style.display === 'none') {
        body.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
      } else {
        body.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    });

    btnClear?.addEventListener('click', () => {
      if (textarea) textarea.value = '';
    });

    btnParse?.addEventListener('click', () => {
      const text = textarea?.value?.trim();
      if (!text) {
        this._toast.error('❌ กรุณาวางข้อความที่ต้องการวิเคราะห์');
        return;
      }

      try {
        const parsed = this._parseLineMessage(text);
        if (Object.keys(parsed).length === 0) {
          this._toast.warning('⚠️ ไม่พบข้อมูลที่ตรงกับคำสำคัญการสร้างสัญญาในข้อความ');
          return;
        }

        // Fill form fields
        if (parsed.po_number !== undefined) document.getElementById('poNumber').value = parsed.po_number;
        if (parsed.project_name !== undefined) document.getElementById('projectName').value = parsed.project_name;
        if (parsed.customer_name !== undefined) document.getElementById('customerName').value = parsed.customer_name;
        
        // Service type mapping
        if (parsed.service_type) {
          const typeMap = {
            'MA': 'MA', 'เอ็มเอ': 'MA',
            'PM': 'PM', 'พีเอ็ม': 'PM',
            'MA+PM': 'MA+PM', 'MA/PM': 'MA+PM', 'MA & PM': 'MA+PM', 'PM+MA': 'MA+PM'
          };
          const normalized = parsed.service_type.toUpperCase().trim();
          const mapped = typeMap[normalized];
          if (mapped) {
            document.getElementById('serviceType').value = mapped;
          } else {
            // Check if select has this option
            const select = document.getElementById('serviceType');
            const hasOption = Array.from(select.options).some(opt => opt.value === normalized);
            if (hasOption) select.value = normalized;
          }
        }

        // Start Date
        if (parsed.start_date) {
          const sDate = this._parseThaiAndGregorianDate(parsed.start_date);
          if (sDate) {
            document.getElementById('startDate').value = sDate.toISOString().slice(0, 10);
          }
        }

        // End Date
        if (parsed.end_date) {
          const eDate = this._parseThaiAndGregorianDate(parsed.end_date);
          if (eDate) {
            document.getElementById('endDate').value = eDate.toISOString().slice(0, 10);
          }
        }

        // Email recipients
        if (parsed.recipients_sale !== undefined) {
          this._saleEmailTags.clear();
          parsed.recipients_sale.split(/[,;\s]+/).forEach(email => {
            if (email.trim() && email.includes('@')) this._saleEmailTags.addEmail(email.trim());
          });
        }

        if (parsed.recipients_eng !== undefined) {
          this._engEmailTags.clear();
          parsed.recipients_eng.split(/[,;\s]+/).forEach(email => {
            if (email.trim() && email.includes('@')) this._engEmailTags.addEmail(email.trim());
          });
        }

        // Webhooks and note
        if (parsed.teams_webhook !== undefined) document.getElementById('teamsWebhook').value = parsed.teams_webhook;
        if (parsed.line_group_id !== undefined) document.getElementById('lineGroupId').value = parsed.line_group_id;
        if (parsed.note !== undefined) document.getElementById('contractNote').value = parsed.note;

        // Notify Time
        if (parsed.notify_time) {
          let time = parsed.notify_time.trim();
          const match = time.match(/^(\d{1,2})[:.](\d{2})$/);
          if (match) {
            const hh = String(parseInt(match[1], 10)).padStart(2, '0');
            const mm = match[2];
            document.getElementById('notifyTime').value = `${hh}:${mm}`;
          } else if (time.match(/^\d{1,2}$/)) {
            const hh = String(parseInt(time, 10)).padStart(2, '0');
            document.getElementById('notifyTime').value = `${hh}:00`;
          }
        }

        // Alert Days
        if (parsed.alert_days) {
          // Uncheck all presets
          ['alert30', 'alert14', 'alert7', 'alert1', 'alert0'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = false;
          });
          this._customAlertDays = [];

          const alertDays = parsed.alert_days.split(/[,;\s]+/)
            .map(d => parseInt(d.trim(), 10))
            .filter(d => !isNaN(d));

          const presetDays = [30, 14, 7, 1, 0];
          alertDays.forEach(val => {
            if (presetDays.includes(val)) {
              const el = document.getElementById(`alert${val}`);
              if (el) el.checked = true;
            } else {
              if (!this._customAlertDays.includes(val) && val >= 0 && val <= 365) {
                this._customAlertDays.push(val);
              }
            }
          });
          this._customAlertDays.sort((a, b) => b - a);
          this._renderCustomAlertTags();
        }

        // Trigger duration preview
        const startInput = document.getElementById('startDate');
        if (startInput) startInput.dispatchEvent(new Event('change'));
        this._renderRecentEmails();

        this._toast.success('✅ วิเคราะห์ข้อมูลและกรอกฟอร์มจากข้อความ LINE สำเร็จ!');
        
        // Collapse card
        body.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      } catch (err) {
        console.error('Line parse error:', err);
        this._toast.error(`❌ เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}`);
      }
    });
  }

  _parseLineMessage(text) {
    const lines = text.split('\n');
    const result = {};
    
    const regexes = {
      po_number: /^(?:PO|พีโอ|เลขที่\s*PO)\s*[:：=\-—\s]\s*(.+)$/i,
      project_name: /^(?:Project|โครงการ|ชื่อโครงการ)\s*[:：=\-—\s]\s*(.+)$/i,
      customer_name: /^(?:Customer|ลูกค้า|ชื่อลูกค้า)\s*[:：=\-—\s]\s*(.+)$/i,
      service_type: /^(?:Type|ประเภทบริการ|ประเภท\s*บริการ|ประเภท|บริการ)\s*[:：=\-—\s]\s*(.+)$/i,
      start_date: /^(?:Start|เริ่ม|วันเริ่มต้น)\s*[:：=\-—\s]\s*(.+)$/i,
      end_date: /^(?:End|หมดอายุ|วันหมดอายุ)\s*[:：=\-—\s]\s*(.+)$/i,
      recipients_sale: /^(?:Sale|เซลล์|ผู้รับผิดชอบเซลล์)\s*[:：=\-—\s]\s*(.+)$/i,
      recipients_eng: /^(?:Eng|วิศวกร|ผู้รับผิดชอบวิศวกร)\s*[:：=\-—\s]\s*(.+)$/i,
      teams_webhook: /^(?:Teams|ทีมส์|เว็บฮุคทีมส์)\s*[:：=\-—\s]\s*(.+)$/i,
      note: /^(?:Note|โน้ต|หมายเหตุ)\s*[:：=\-—\s]\s*(.+)$/i,
      line_group_id: /^(?:Group\s*ID|กลุ่ม|ไลน์กลุ่ม|ไอดีกลุ่ม)\s*[:：=\-—\s]\s*(.+)$/i,
      alert_days: /^(?:Alert|แจ้งเตือนก่อน|เตือนล่วงหน้า)\s*[:：=\-—\s]\s*(.+)$/i,
      notify_time: /^(?:Time|เวลาแจ้งเตือน|เวลาส่ง)\s*[:：=\-—\s]\s*(.+)$/i
    };

    lines.forEach(line => {
      line = line.trim();
      if (!line) return;
      
      for (const [key, regex] of Object.entries(regexes)) {
        const match = line.match(regex);
        if (match) {
          result[key] = match[1].trim();
          break; 
        }
      }
    });
    
    return result;
  }

  _parseThaiAndGregorianDate(dateStr) {
    if (!dateStr) return null;
    dateStr = dateStr.trim();

    // 1) Match YYYY-MM-DD or YYYY/MM/DD
    let match = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (match) {
      let year = parseInt(match[1], 10);
      let month = parseInt(match[2], 10) - 1;
      let day = parseInt(match[3], 10);
      if (year >= 2500) year -= 543;
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }

    // 2) Match DD-MM-YYYY or DD/MM/YYYY
    match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      let day = parseInt(match[1], 10);
      let month = parseInt(match[2], 10) - 1;
      let year = parseInt(match[3], 10);
      if (year >= 2500) year -= 543;
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }

    // 3) Match DD-MM-YY or DD/MM/YY (e.g. 31/12/69)
    match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})$/);
    if (match) {
      let day = parseInt(match[1], 10);
      let month = parseInt(match[2], 10) - 1;
      let shortYear = parseInt(match[3], 10);
      let year = shortYear >= 50 ? (2500 + shortYear - 543) : (2000 + shortYear);
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }

    // Fallback
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) {
      const date = new Date(parsed);
      if (date.getFullYear() >= 2500) {
        date.setFullYear(date.getFullYear() - 543);
      }
      return date;
    }

    return null;
  }

  _renderLineGroupSelector() {
    const container = document.getElementById('lineGroupSelector');
    if (!container) return;

    const contracts = this._getContracts() || [];
    const uniqueGroups = [];
    const seenIds = new Set();

    contracts.forEach(c => {
      if (c.line_group_id && !seenIds.has(c.line_group_id)) {
        seenIds.add(c.line_group_id);
        uniqueGroups.push({
          id: c.line_group_id,
          name: c.line_group_name || c.line_group_id
        });
      }
    });

    if (uniqueGroups.length === 0) {
      container.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted)">(ไม่มีประวัติไลน์กลุ่มที่เชื่อมต่อในระบบ)</span>';
      return;
    }

    const currentVal = document.getElementById('lineGroupId').value.trim();

    container.innerHTML = `
      <div class="group-chips">
        ${uniqueGroups.map(g => {
          const isActive = g.id === currentVal;
          return `
            <button type="button" class="group-chip ${isActive ? 'active' : ''}" data-id="${g.id}" title="Group ID: ${g.id}">
              💬 ${g.name}
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Bind click events
    container.querySelectorAll('.group-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selectedId = btn.dataset.id;
        const input = document.getElementById('lineGroupId');
        
        if (btn.classList.contains('active')) {
          // If clicked active, deselect it
          input.value = '';
          btn.classList.remove('active');
        } else {
          // Select it
          input.value = selectedId;
          container.querySelectorAll('.group-chip').forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
        }
        
        // Trigger input event to let other things know it changed
        input.dispatchEvent(new Event('input'));
      });
    });
  }

  _syncLineGroupActiveChip() {
    const inputVal = document.getElementById('lineGroupId').value.trim();
    const container = document.getElementById('lineGroupSelector');
    if (!container) return;
    
    container.querySelectorAll('.group-chip').forEach(btn => {
      if (btn.dataset.id === inputVal) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  _bindActionButtons() {
    document.getElementById('btnCancel')?.addEventListener('click', () => {
      if (this._editMode) {
        this.exitEditMode();
      }
      this._navigate('dashboard');
    });
  }
}
