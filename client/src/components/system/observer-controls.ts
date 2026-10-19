const prohibited =
  /(?:إضافة|اضافة|إنشاء|انشاء|حفظ|تعديل|تحرير|حذف|تعطيل|تفعيل|استيراد|تصدير|تحميل|تنزيل|طباعة|اعتماد|موافقة|رفض|إرسال|ارسال|صرف|إرجاع|ارجاع|تأكيد|تاكيد|تنفيذ|معالجة|تسجيل|استعادة|رفع|إسناد|اسناد|تعيين|نقل|تحويل|شراء|إصلاح|اصلاح|تحديث\s+(?:الحالة|البيانات|السجل)|add|create|save|edit|delete|remove|disable|activate|import|export|download|print|approve|reject|submit|send|issue|return|confirm|execute|process|record|restore|upload|assign|transfer|purchase|repair)/i;
const view =
  /(?:بحث|تحديث|عرض|تفاصيل|فتح|رجوع|عودة|إلغاء|الغاء|إغلاق|اغلاق|السابق|التالي|الكل|إخفاء|اخفاء|إظهار|اظهار|تصفية|فلتر|فلاتر|مسح البحث|توسيع|طي|خروج|إعادة المحاولة|تلاش|تازہ|تفصیلات|واپس|منسوخ|بند|اگلا|پچھلا|دکھائیں|چھپائیں|search|refresh|retry|view|details|open|back|cancel|close|previous|next|all|hide|show|filter|clear|expand|collapse|logout)/i;
const dangerousIcon =
  /lucide-(?:plus|pencil|pen-line|square-pen|trash|trash-2|download|upload|printer|save|check-check|file-down|file-up)/;
const viewingIcon =
  /lucide-(?:eye|chevron|arrow-left|arrow-right|search|filter|refresh|x(?:\s|$)|menu|panel-left|panel-right|ellipsis|more|settings-2|sun|moon|languages|globe)/;

export function observerControlBlocked(el: Element): boolean {
  // An enclosing navigation region must never make upload/export links usable.
  if (el.matches('input[type="file"],a[download]')) return true;
  if (el.tagName === "A")
    return /(?:\/api\/(?:export|reports)|\.(?:csv|xlsx?|pdf|zip|json)(?:[?#]|$)|^(?:blob|data):)/i.test(
      el.getAttribute("href") ?? ""
    );
  if (el.closest('[data-observer-navigation="true"]')) return false;
  if (
    !el.matches('button,[role="button"],[role="menuitem"],input[type="submit"]')
  )
    return false;
  const role = el.getAttribute("role");
  // Session cleanup is an explicitly allowed action, regardless of its label.
  if (el.getAttribute("data-observer-action") === "logout") return false;
  // Tabs/selects may contain business action words in their navigation labels.
  if (["tab", "combobox"].includes(role ?? "")) return false;
  const text =
    `${el.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`.trim();
  const icons = Array.from(el.querySelectorAll("svg"))
    .map(svg => svg.getAttribute("class") ?? "")
    .join(" ");
  if (dangerousIcon.test(icons)) return true;
  if (
    /(?:إلغاء|الغاء)\s+(?:الطلب|التذكرة|البلاغ|المهمة|العملية|البرنامج)|cancel\s+(?:order|ticket|task|operation|program)/i.test(
      text
    )
  )
    return true;
  if (
    /^(?:تحميل المزيد|عرض المزيد|load more|show more|العربية|English|اردو|Urdu)$/i.test(
      text
    )
  )
    return false;
  if (
    /^(?:عرض|فتح|تفاصيل|إظهار|إخفاء|اظهار|اخفاء|view|open|details|show|hide)(?:\s|$)/i.test(
      text
    ) &&
    !/(?:إضافة|اضافة|إنشاء|انشاء|حفظ|تعديل|حذف|اعتماد|موافقة|رفض|تأكيد|تنفيذ|تصدير|استيراد|تحميل|تنزيل|طباعة|add|create|save|edit|delete|approve|reject|confirm|execute|export|import|download|print)/i.test(
      text
    )
  )
    return false;
  if (prohibited.test(text)) return true;
  // Account menus, accordions and filter popovers only open existing content.
  // Evaluate prohibited labels/icons first, including export/import popovers.
  if (el.hasAttribute("aria-controls") && el.hasAttribute("aria-expanded"))
    return false;
  return !(view.test(text) || viewingIcon.test(icons));
}

/** Observer-only DOM boundary includes Radix portals and locally generated exports. */
export function installObserverControls(doc: Document): () => void {
  const original = new Map<
    Element,
    { disabled: string | null; aria: string | null; marker: string | null }
  >();
  const scan = () => {
    for (const el of Array.from(original.keys())) {
      if (typeof doc.contains === "function" && !doc.contains(el)) restore(el);
    }
    for (const el of Array.from(
      doc.querySelectorAll(
        'button,[role="button"],[role="menuitem"],input[type="file"],input[type="submit"],a'
      )
    )) {
      const blocked = observerControlBlocked(el);
      if (blocked && !original.has(el)) {
        original.set(el, {
          disabled: el.getAttribute("disabled"),
          aria: el.getAttribute("aria-disabled"),
          marker: el.getAttribute("data-observer-blocked"),
        });
        el.setAttribute("data-observer-blocked", "true");
        el.setAttribute("aria-disabled", "true");
        if (el.matches("button,input")) el.setAttribute("disabled", "");
      } else if (!blocked && original.has(el)) restore(el);
      if (blocked) {
        if (el.getAttribute("aria-disabled") !== "true")
          el.setAttribute("aria-disabled", "true");
        if (el.matches("button,input") && !el.hasAttribute("disabled"))
          el.setAttribute("disabled", "");
      }
    }
  };
  function restore(el: Element) {
    const prior = original.get(el);
    if (!prior) return;
    for (const [key, value] of [
      ["disabled", prior.disabled],
      ["aria-disabled", prior.aria],
      ["data-observer-blocked", prior.marker],
    ] as const)
      if (value === null) el.removeAttribute(key);
      else el.setAttribute(key, value);
    original.delete(el);
  }
  const stop = (event: Event) => {
    const target = event.target as Element | null;
    const el = target?.closest?.(
      'button,[role="button"],[role="menuitem"],input[type="file"],input[type="submit"],a'
    );
    if (
      (event.type === "submit" &&
        !target?.querySelector?.(
          'input[type="search"],input[placeholder*="بحث"],input[placeholder*="ابحث"],input[placeholder*="Search"],input[aria-label*="بحث"]'
        )) ||
      (event.type === "drop" &&
        (event as DragEvent).dataTransfer?.files.length) ||
      (el && observerControlBlocked(el))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const events = ["click", "auxclick", "submit", "keydown", "change", "drop"];
  for (const name of events) doc.addEventListener(name, stop, true);
  scan();
  const observer = new MutationObserver(scan);
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "disabled",
      "aria-label",
      "title",
      "href",
      "download",
      "type",
      "class",
      "data-observer-action",
      "data-observer-navigation",
      "role",
      "aria-controls",
      "aria-expanded",
    ],
  });
  return () => {
    observer.disconnect();
    for (const name of events) doc.removeEventListener(name, stop, true);
    for (const el of Array.from(original.keys())) restore(el);
  };
}
