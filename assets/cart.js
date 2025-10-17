/* peekaboo front-end cart
   - single-file implementation: localStorage persistence, badge, add-to-cart interception,
     injected Add buttons, slide-in panel rendering and simple checkout placeholder.
   - key behaviors:
     * stores cart in localStorage under 'peekaboo_cart'
     * exposes window.peekabooCart API (addToCart, loadCart, saveCart, renderCart)
     * attaches badge to the first header element that is NOT inside #account-modal or #woo-cart-panel
     * intercepts theme anchors like a.add_to_cart_button and adds items client-side
*/
(function(){
  const LS_KEY = 'peekaboo_cart';
  const CURRENCY_SYMBOL = '₹';

  function loadCart(){ try{ const s = localStorage.getItem(LS_KEY); return s?JSON.parse(s):[] }catch(e){ return [] } }
  function saveCart(cart){ try{ localStorage.setItem(LS_KEY, JSON.stringify(cart)); }catch(e){} }

  function formatPriceNumber(v){
    if(v==null) return 0;
    return Number(String(v).replace(/[^0-9.]/g,''))||0;
  }

  function findProductData(root){
    if(!root) root = document.body;
    // Prefer the nearest product container so we don't accidentally read the button text
    const container = (root.closest && (root.closest('li.product') || root.closest('.product') || root.closest('.wp-block-column'))) || root;

    // title: try several selectors inside the product container and avoid reading button/anchor text
    const titleSelectors = ['.woocommerce-loop-product__title', '.product-title', '.ct-woo-card-title', 'h2', 'h3', 'h4', '.ct-dynamic-data a'];
    let titleEl = null;
    for(const s of titleSelectors){ if(container.querySelector && container.querySelector(s)){ titleEl = container.querySelector(s); break; } }
    let title = titleEl ? titleEl.textContent.trim() : (container.getAttribute && container.getAttribute('data-title')) || '';
    if(!title){
      // fallback: find an anchor that is not an add-to-cart button
      const link = container.querySelector && container.querySelector('a:not(.add_to_cart_button):not(.front-add-to-cart)');
      if(link) title = link.textContent.trim();
    }

    const priceEl = container.querySelector && container.querySelector('.woocommerce-Price-amount, .price, .amount, .ct-price');
    const priceText = priceEl? priceEl.textContent.trim() : '';
    const price = formatPriceNumber(priceText);
    const imgEl = container.querySelector && (container.querySelector('img') || container.querySelector('.ct-media-container img'));
    const img = imgEl && imgEl.src ? imgEl.src : '';

    let id = '';
    if(container && container.getAttribute){ id = container.getAttribute('data-product-id') || container.getAttribute('data-product_id') || container.getAttribute('data-wc-key') || ''; }
    if(!id && container && container.className){ const m = String(container.className).match(/post-(\d+)/); if(m) id = m[1]; }
    if(!id) id = (title || 'Product') + '|' + price;
    return { id, title: title || 'Product', price, img };
  }

  function addToCart(item){
    if(!item || !item.id) return;
    const cart = loadCart();
    const existing = cart.find(i=>i.id===item.id);
    if(existing){ existing.qty = (existing.qty||1) + 1; }
    else{ item.qty = item.qty || 1; cart.push(item); }
    saveCart(cart);
    renderCart();
    flashAdded(item.title || 'Item');
  }

  function flashAdded(text){
    const el = document.createElement('div'); el.textContent = 'Added: ' + text;
    Object.assign(el.style,{position:'fixed',right:'20px',bottom:'20px',background:'#111',color:'#fff',padding:'8px 12px',borderRadius:'8px',zIndex:99999,opacity:0,transition:'opacity .18s'});
    document.body.appendChild(el); requestAnimationFrame(()=>el.style.opacity='1');
    setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=>el.remove(),220) },1200);
  }

  function ensureBadgeParent(){
    // choose first header-like element not inside account modal or cart panel
    const candidates = Array.from(document.querySelectorAll('.ct-header-account, header'));
    let headerAccount = candidates.find(el => !el.closest('#account-modal') && !el.closest('#woo-cart-panel'));
    if(!headerAccount) headerAccount = candidates[0] || document.querySelector('header') || document.body;
    return headerAccount;
  }

  function getOrCreateBadge(){
    let badge = document.querySelector('.fb-cart-badge');
    if(badge) return badge;
    const parent = ensureBadgeParent();
    if(!parent) return null;
    badge = document.createElement('span');
    badge.className = 'fb-cart-badge';
    badge.textContent = '0';
    // small wrapper to avoid breaking structure
    try{ parent.appendChild(badge); }catch(e){ document.body.appendChild(badge); }
    return badge;
  }

  function renderCart(){
    const panel = document.querySelector('#woo-cart-panel');
    const content = panel && panel.querySelector('.ct-panel-content-inner');
    if(!content) return;
    const cart = loadCart();

    // update header badge
    const badge = getOrCreateBadge();
    if(badge) badge.textContent = (cart.reduce((s,i)=>s + (i.qty||0), 0) || 0);

    if(!cart || cart.length===0){ content.innerHTML = '<p class="woocommerce-mini-cart__empty-message front-cart-empty">No products in the cart.</p>'; return; }

    const ul = document.createElement('ul'); ul.className = 'front-cart-list';
    let subtotal = 0;
    cart.forEach(item=>{
      const li = document.createElement('li'); li.className = 'front-cart-item';
      const img = document.createElement('img'); img.src = item.img || ''; img.alt = item.title || 'Product';
      const meta = document.createElement('div'); meta.className = 'meta';
      const title = document.createElement('div'); title.className = 'title'; title.textContent = item.title || 'Product';
      const price = document.createElement('div'); price.className = 'price'; price.textContent = (CURRENCY_SYMBOL + ((item.price||0).toFixed(2)));
      meta.appendChild(title); meta.appendChild(price);

      const controls = document.createElement('div'); controls.className = 'front-cart-controls';
      const minus = document.createElement('button'); minus.type = 'button'; minus.textContent = '-';
      const qty = document.createElement('span'); qty.textContent = item.qty || 1; qty.style.minWidth='22px'; qty.style.textAlign='center';
      const plus = document.createElement('button'); plus.type = 'button'; plus.textContent = '+';
      const rem = document.createElement('button'); rem.type = 'button'; rem.textContent = 'Remove'; rem.style.marginLeft = '8px';
      controls.appendChild(minus); controls.appendChild(qty); controls.appendChild(plus); controls.appendChild(rem);

      minus.addEventListener('click', ()=>{ const c = loadCart(); const it = c.find(x=>x.id===item.id); if(!it) return; it.qty = Math.max(1,(it.qty||1)-1); saveCart(c); renderCart(); });
      plus.addEventListener('click', ()=>{ const c = loadCart(); const it = c.find(x=>x.id===item.id); if(!it) return; it.qty = (it.qty||1) + 1; saveCart(c); renderCart(); });
      rem.addEventListener('click', ()=>{ let c = loadCart(); c = c.filter(x=>x.id!==item.id); saveCart(c); renderCart(); });

      li.appendChild(img); li.appendChild(meta); li.appendChild(controls); ul.appendChild(li);
      subtotal += (item.price||0) * (item.qty||1);
    });

    const footer = document.createElement('div'); footer.style.padding='12px 0';
    footer.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;font-weight:700"><span>Subtotal</span><span>'+CURRENCY_SYMBOL+subtotal.toFixed(2)+'</span></div><div style="margin-top:8px"><button class="ct-button" id="front-cart-checkout">Proceed to Checkout</button></div>';

    content.innerHTML = ''; content.appendChild(ul); content.appendChild(footer);

    const co = document.getElementById('front-cart-checkout'); if(co) co.addEventListener('click', ()=>{ window.location.href = './shop.html'; });
  }

  function openCart(){ const panel = document.querySelector('#woo-cart-panel'); if(!panel) return; panel.classList.add('open'); renderCart(); }
  function closeCart(){ const panel = document.querySelector('#woo-cart-panel'); if(!panel) return; panel.classList.remove('open'); }

  // intercept links like <a href="#view-cart"> and close toggle
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a[href="#view-cart"], [data-action="view-cart"]');
    if(a){ e.preventDefault(); openCart(); return; }
    if(e.target.closest && e.target.closest('#woo-cart-panel .ct-toggle-close')){ e.preventDefault(); closeCart(); }
  });

  // intercept theme add-to-cart anchors and add to front-end cart instead of navigation
  document.addEventListener('click', function(e){
    const a = e.target.closest && e.target.closest('a.add_to_cart_button, a.button.product_type_simple.add_to_cart_button, a.button.product_type_simple');
    if(!a) return;
    // if anchor has an href with ?add-to-cart=, stop navigation and add
    try{
      e.preventDefault();
      const li = a.closest && (a.closest('li.product') || a.closest('.product') || a.closest('.wp-block-column'));
      const data = findProductData(li || a);
      const pid = a.getAttribute && (a.getAttribute('data-product_id') || a.getAttribute('data-product-id'));
      if(pid) data.id = pid + '|' + (data.id || data.title);
      addToCart(data);
    }catch(err){ return; }
  }, true);

  // inject "Add to cart" buttons next to existing buttons for theme that doesn't show visible buttons
  function attachAddButtons(){
    const items = document.querySelectorAll('ul.products li.product, .wc-block-product, .type-product');
    items.forEach(li=>{
      if(!li) return;
      // if we've already injected a button and there's no original anchor, skip
      if(li.querySelector('button.front-add-to-cart') && !li.querySelector('a.add_to_cart_button')) return;
      const existing = li.querySelector('a.add_to_cart_button, .button.add_to_cart, .add-to-cart, a.button');

      const btn = document.createElement('button');
      btn.type='button';
      btn.className = 'front-add-to-cart';
      btn.textContent = 'Add to cart';

      // If theme anchor exists: replace it with our button but keep its classes/attributes so styling remains identical
      if(existing){
        try{
          // copy class names so the button looks like the original anchor
          if(existing.className) btn.className = existing.className + ' front-add-to-cart';
          // copy inline style
          if(existing.getAttribute && existing.getAttribute('style')) btn.setAttribute('style', existing.getAttribute('style'));
          // copy data-* attributes (product id etc.) to the button so our handler can use them
          Array.from(existing.attributes).forEach(attr=>{
            if(/^data-/i.test(attr.name)) btn.setAttribute(attr.name, attr.value);
          });
          existing.parentNode.replaceChild(btn, existing);
        }catch(e){
          if(existing.parentNode) existing.parentNode.insertBefore(btn, existing.nextSibling);
        }
      } else {
        const container = li.querySelector('.wp-block-column, .ct-dynamic-data, .ct-dynamic-media') || li;
        container.appendChild(btn);
      }

      btn.addEventListener('click', ()=>{
        const data = findProductData(li);
        const pid = btn.getAttribute && (btn.getAttribute('data-product_id') || btn.getAttribute('data-product-id'));
        if(pid) data.id = pid + '|' + (data.id || data.title);
        addToCart(data);
      });
    });
  }

  // Convert existing theme anchors (a.add_to_cart_button etc.) into <button> elements so the page shows only our button
  function convertThemeAnchors(){
    const anchors = Array.from(document.querySelectorAll('a.add_to_cart_button, a.button.product_type_simple.add_to_cart_button, a.button.product_type_simple'));
    anchors.forEach(a=>{
      // skip if already handled (we replaced it with a button earlier)
      if(!a.parentNode) return;
      // create replacement button
      const btn = document.createElement('button'); btn.type='button';
      // copy classes and add marker class
      if(a.className) btn.className = a.className + ' front-add-to-cart'; else btn.className = 'front-add-to-cart';
      // copy inline styles
      if(a.getAttribute && a.getAttribute('style')) btn.setAttribute('style', a.getAttribute('style'));
      // copy data-* attributes
      Array.from(a.attributes).forEach(attr=>{ if(/^data-/i.test(attr.name)) btn.setAttribute(attr.name, attr.value); });
      // copy text
      btn.textContent = a.textContent.trim() || 'Add to cart';

      // hook click to addToCart
      btn.addEventListener('click', function(){
        const li = a.closest && (a.closest('li.product') || a.closest('.product') || a.closest('.wp-block-column'));
        const data = findProductData(li || btn);
        const pid = btn.getAttribute && (btn.getAttribute('data-product_id') || btn.getAttribute('data-product-id'));
        if(pid) data.id = pid + '|' + (data.id || data.title);
        addToCart(data);
      });

      // replace anchor with button
      try{ a.parentNode.replaceChild(btn, a); }catch(e){}
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // Convert theme anchors to buttons so there's only one add-to-cart control per product
    convertThemeAnchors();
    attachAddButtons(); renderCart();

    // Observe product lists for dynamic changes and keep converting/re-injecting as needed
    const ul = document.querySelector('ul.products');
    if(ul){ const obs = new MutationObserver(()=>{ convertThemeAnchors(); attachAddButtons(); }); obs.observe(ul,{childList:true,subtree:true}); }
    // global observer for late-added anchors
    const bodyObs = new MutationObserver(()=>{ convertThemeAnchors(); });
    bodyObs.observe(document.body, { childList:true, subtree:true });
  });

  window.peekabooCart = { loadCart, saveCart, renderCart, addToCart };
})();
