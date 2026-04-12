// ============================================
// DQD TRANSLATIONS — Optimized Architecture
// ============================================

const DICT = {
  'nav.home':        { vi: 'Trang Chủ',         en: 'Home' },
  'nav.products':    { vi: 'Sản Phẩm',           en: 'Products' },
  'nav.about':       { vi: 'Về Chúng Tôi',       en: 'About Us' },
  'nav.contact':     { vi: 'Liên Hệ',            en: 'Contact' },
  'nav.policy':      { vi: 'Chính Sách',         en: 'Policy' },
  'nav.partners':    { vi: 'Đối Tác',            en: 'Partners' },
  'nav.account':     { vi: 'Tài Khoản',          en: 'Account' },
  'nav.login':       { vi: 'Đăng Nhập',          en: 'Login' },
  'nav.register':    { vi: 'Đăng Ký',            en: 'Register' },
  'nav.logout':      { vi: 'Đăng Xuất',          en: 'Logout' },

  'cat.all':         { vi: 'Tất Cả Sản Phẩm',   en: 'All Products' },
  'cat.living':      { vi: 'Phòng Khách',        en: 'Living Room' },
  'cat.bedroom':     { vi: 'Phòng Ngủ',          en: 'Bedroom' },
  'cat.kitchen':     { vi: 'Nhà Bếp',            en: 'Kitchen' },
  'cat.office':      { vi: 'Văn Phòng',          en: 'Office' },
  'cat.dining':      { vi: 'Phòng Ăn',           en: 'Dining Room' },
  'cat.label':       { vi: 'Danh Mục',           en: 'Categories' },

  'promo.new_collection':  { vi: 'Bộ Sưu Tập Mới',             en: 'New Collection' },
  'promo.explore_now':     { vi: 'Khám Phá Ngay',              en: 'Explore Now' },
  'promo.freeship_badge':  { vi: 'Freeship 0Đ',                en: 'Free Shipping' },
  'promo.free_design':     { vi: 'Thiết Kế Miễn Phí',         en: 'Free Design' },
  'promo.sale_35':         { vi: 'Giảm đến 35% sản phẩm mới', en: 'Up to 35% off new products' },
  'promo.free_nationwide': { vi: 'Miễn phí vận chuyển toàn quốc', en: 'Free nationwide shipping' },
  'promo.design_3d':       { vi: 'Tư vấn thiết kế 3D nội thất',   en: 'Free 3D design consultation' },
  'promo.furniture_col':   { vi: 'Bộ Sưu Tập Nội Thất',       en: 'Furniture Collection' },
  'promo.explore_products':{ vi: 'Khám Phá Sản Phẩm',         en: 'Explore Products' },
  'promo.free_ship_5m':    { vi: 'Miễn phí vận chuyển đơn trên 5 triệu', en: 'Free shipping over 5M VND' },

  'product.view_detail':   { vi: 'Xem Chi Tiết',              en: 'View Details' },
  'product.add_cart':      { vi: 'Thêm Vào Giỏ',             en: 'Add to Cart' },
  'product.buy_now':       { vi: 'Mua Ngay',                  en: 'Buy Now' },
  'product.price':         { vi: 'Giá',                       en: 'Price' },
  'product.in_stock':      { vi: 'Còn Hàng',                  en: 'In Stock' },
  'product.out_of_stock':  { vi: 'Hết Hàng',                  en: 'Out of Stock' },
  'product.quantity':      { vi: 'Số Lượng',                  en: 'Quantity' },
  'product.description':   { vi: 'Mô Tả',                     en: 'Description' },
  'product.specs':         { vi: 'Thông Số Kỹ Thuật',        en: 'Specifications' },
  'product.reviews':       { vi: 'Đánh Giá',                  en: 'Reviews' },
  'product.sale':          { vi: 'Khuyến Mãi',                en: 'Sale' },

  'cart.title':            { vi: 'Giỏ Hàng',                  en: 'Shopping Cart' },
  'cart.total':            { vi: 'Tổng Tiền',                  en: 'Total' },
  'cart.subtotal':         { vi: 'Tạm Tính',                   en: 'Subtotal' },
  'cart.shipping_fee':     { vi: 'Phí Vận Chuyển',            en: 'Shipping Fee' },
  'cart.checkout':         { vi: 'Thanh Toán',                 en: 'Checkout' },
  'cart.continue':         { vi: 'Tiếp Tục Mua Sắm',          en: 'Continue Shopping' },
  'cart.update':           { vi: 'Cập Nhật Giỏ Hàng',        en: 'Update Cart' },
  'cart.remove':           { vi: 'Xóa',                        en: 'Remove' },
  'cart.clear':            { vi: 'Xóa Tất Cả',                en: 'Clear All' },
  'cart.empty':            { vi: 'Giỏ Hàng Trống',            en: 'Empty Cart' },

  'checkout.place_order':  { vi: 'Đặt Hàng',                  en: 'Place Order' },
  'checkout.ship_info':    { vi: 'Thông Tin Giao Hàng',       en: 'Shipping Information' },
  'checkout.fullname':     { vi: 'Họ Và Tên',                 en: 'Full Name' },
  'checkout.phone':        { vi: 'Số Điện Thoại',             en: 'Phone Number' },
  'checkout.email':        { vi: 'Email',                      en: 'Email' },
  'checkout.address':      { vi: 'Địa Chỉ',                   en: 'Address' },
  'checkout.city':         { vi: 'Thành Phố',                 en: 'City' },
  'checkout.district':     { vi: 'Quận/Huyện',                en: 'District' },
  'checkout.ward':         { vi: 'Phường/Xã',                 en: 'Ward' },
  'checkout.note':         { vi: 'Ghi Chú',                   en: 'Note' },
  'checkout.payment_method':{ vi: 'Phương Thức Thanh Toán',   en: 'Payment Method' },
  'checkout.cod':          { vi: 'Thanh Toán Khi Nhận Hàng',  en: 'Cash on Delivery' },
  'checkout.bank':         { vi: 'Chuyển Khoản Ngân Hàng',   en: 'Bank Transfer' },
  'checkout.credit_card':  { vi: 'Thẻ Tín Dụng',             en: 'Credit Card' },

  'order.id':              { vi: 'Mã Đơn Hàng',               en: 'Order ID' },
  'order.date':            { vi: 'Ngày Đặt',                  en: 'Order Date' },
  'order.status':          { vi: 'Trạng Thái',                en: 'Status' },
  'order.details':         { vi: 'Chi Tiết Đơn Hàng',         en: 'Order Details' },
  'order.history':         { vi: 'Lịch Sử Đơn Hàng',         en: 'Order History' },
  'order.track':           { vi: 'Theo Dõi Đơn Hàng',         en: 'Track Order' },
  'order.s.processing':    { vi: 'Đang Xử Lý',                en: 'Processing' },
  'order.s.confirmed':     { vi: 'Đã Xác Nhận',               en: 'Confirmed' },
  'order.s.shipping':      { vi: 'Đang Giao Hàng',            en: 'Shipping' },
  'order.s.delivered':     { vi: 'Đã Giao',                   en: 'Delivered' },
  'order.s.cancelled':     { vi: 'Đã Hủy',                    en: 'Cancelled' },
  'order.s.pending':       { vi: 'Chờ Xử Lý',                 en: 'Pending' },

  'acc.my_account':        { vi: 'Tài Khoản Của Tôi',         en: 'My Account' },
  'acc.profile':           { vi: 'Hồ Sơ',                     en: 'Profile' },
  'acc.my_orders':         { vi: 'Đơn Hàng Của Tôi',          en: 'My Orders' },
  'acc.wishlist':          { vi: 'Yêu Thích',                  en: 'Wishlist' },
  'acc.settings':          { vi: 'Cài Đặt',                   en: 'Settings' },
  'acc.change_pw':         { vi: 'Đổi Mật Khẩu',              en: 'Change Password' },
  'acc.old_pw':            { vi: 'Mật Khẩu Cũ',               en: 'Old Password' },
  'acc.new_pw':            { vi: 'Mật Khẩu Mới',              en: 'New Password' },
  'acc.confirm_pw':        { vi: 'Xác Nhận Mật Khẩu',         en: 'Confirm Password' },

  'footer.quick_links':    { vi: 'Liên Kết Nhanh',            en: 'Quick Links' },
  'footer.support':        { vi: 'Hỗ Trợ',                   en: 'Support' },
  'footer.buy_guide':      { vi: 'Hướng Dẫn Mua Hàng',       en: 'Shopping Guide' },
  'footer.return':         { vi: 'Chính Sách Đổi Trả',        en: 'Return Policy' },
  'footer.warranty':       { vi: 'Bảo Hành',                  en: 'Warranty' },
  'footer.faq':            { vi: 'Câu Hỏi Thường Gặp',        en: 'FAQ' },
  'footer.cust_service':   { vi: 'Chăm Sóc Khách Hàng',      en: 'Customer Service' },
  'footer.terms':          { vi: 'Điều Khoản Dịch Vụ',        en: 'Terms of Service' },
  'footer.privacy':        { vi: 'Chính Sách Bảo Mật',        en: 'Privacy Policy' },

  'action.search':         { vi: 'Tìm Kiếm',                  en: 'Search' },
  'action.view_more':      { vi: 'Xem Thêm',                  en: 'View More' },
  'action.details':        { vi: 'Chi Tiết',                   en: 'Details' },
  'action.send':           { vi: 'Gửi',                        en: 'Send' },
  'action.cancel':         { vi: 'Hủy',                        en: 'Cancel' },
  'action.close':          { vi: 'Đóng',                       en: 'Close' },
  'action.save':           { vi: 'Lưu',                        en: 'Save' },
  'action.update':         { vi: 'Cập Nhật',                   en: 'Update' },
  'action.delete':         { vi: 'Xóa',                        en: 'Delete' },
  'action.edit':           { vi: 'Chỉnh Sửa',                  en: 'Edit' },
  'action.back':           { vi: 'Quay Lại',                   en: 'Back' },
  'action.next':           { vi: 'Tiếp Theo',                  en: 'Next' },
  'action.prev':           { vi: 'Trước',                      en: 'Previous' },
  'action.all':            { vi: 'Tất Cả',                     en: 'All' },
  'action.filter':         { vi: 'Lọc',                        en: 'Filter' },
  'action.sort':           { vi: 'Sắp Xếp',                    en: 'Sort' },
  'action.apply':          { vi: 'Áp Dụng',                    en: 'Apply' },
  'action.reset':          { vi: 'Đặt Lại',                    en: 'Reset' },

  'sort.label':            { vi: 'Sắp Xếp Theo',              en: 'Sort By' },
  'sort.price_asc':        { vi: 'Giá: Thấp Đến Cao',         en: 'Price: Low to High' },
  'sort.price_desc':       { vi: 'Giá: Cao Đến Thấp',         en: 'Price: High to Low' },
  'sort.newest':           { vi: 'Mới Nhất',                   en: 'Newest' },
  'sort.best_selling':     { vi: 'Bán Chạy',                   en: 'Best Selling' },
  'sort.popular':          { vi: 'Phổ Biến Nhất',              en: 'Most Popular' },
  'filter.price_range':    { vi: 'Khoảng Giá',                en: 'Price Range' },

  'msg.success':           { vi: 'Thành Công',                 en: 'Success' },
  'msg.error':             { vi: 'Lỗi',                        en: 'Error' },
  'msg.warning':           { vi: 'Cảnh Báo',                  en: 'Warning' },
  'msg.info':              { vi: 'Thông Tin',                  en: 'Info' },
  'msg.loading':           { vi: 'Đang Tải',                   en: 'Loading' },
  'msg.please_wait':       { vi: 'Vui Lòng Đợi',              en: 'Please wait' },
  'msg.no_results':        { vi: 'Không Tìm Thấy Kết Quả',   en: 'No results found' },
  'msg.added_cart':        { vi: 'Đã Thêm Vào Giỏ Hàng',     en: 'Item added to cart' },
  'msg.removed_cart':      { vi: 'Đã Xóa Khỏi Giỏ Hàng',     en: 'Item removed from cart' },
  'msg.order_success':     { vi: 'Đặt Hàng Thành Công',       en: 'Order placed successfully' },
  'msg.fill_required':     { vi: 'Vui Lòng Điền Đầy Đủ Thông Tin', en: 'Please fill all required fields' },
  'msg.invalid_email':     { vi: 'Email Không Hợp Lệ',        en: 'Invalid email address' },
  'msg.invalid_phone':     { vi: 'Số Điện Thoại Không Hợp Lệ', en: 'Invalid phone number' },

  'contact.us':            { vi: 'Liên Hệ Với Chúng Tôi',    en: 'Contact Us' },
  'contact.get_in_touch':  { vi: 'Liên Hệ',                   en: 'Get in Touch' },
  'contact.send_msg':      { vi: 'Gửi Tin Nhắn',              en: 'Send Message' },
  'contact.your_msg':      { vi: 'Tin Nhắn Của Bạn',          en: 'Your Message' },
  'contact.location':      { vi: 'Vị Trí Của Chúng Tôi',     en: 'Our Location' },
  'contact.hours':         { vi: 'Giờ Mở Cửa',                en: 'Opening Hours' },
  'about.store':           { vi: 'Về Cửa Hàng Chúng Tôi',    en: 'About Our Store' },
  'about.mission':         { vi: 'Sứ Mệnh',                   en: 'Our Mission' },
  'about.vision':          { vi: 'Tầm Nhìn',                  en: 'Our Vision' },
  'about.why_us':          { vi: 'Tại Sao Chọn Chúng Tôi',   en: 'Why Choose Us' },

  'feat.free_ship':        { vi: 'Miễn Phí Vận Chuyển',      en: 'Free Shipping' },
  'feat.fast_delivery':    { vi: 'Giao Hàng Nhanh',           en: 'Fast Delivery' },
  'feat.quality':          { vi: 'Đảm Bảo Chất Lượng',       en: 'Quality Guarantee' },
  'feat.secure_pay':       { vi: 'Thanh Toán An Toàn',        en: 'Secure Payment' },
  'feat.support_247':      { vi: 'Hỗ Trợ 24/7',              en: '24/7 Support' },
  'feat.best_price':       { vi: 'Giá Tốt Nhất',              en: 'Best Price' },
  'feat.special_offer':    { vi: 'Ưu Đãi Đặc Biệt',          en: 'Special Offer' },
  'feat.new_arrival':      { vi: 'Hàng Mới Về',               en: 'New Arrival' },
  'feat.featured':         { vi: 'Sản Phẩm Nổi Bật',         en: 'Featured Products' },
  'feat.recommended':      { vi: 'Được Đề Xuất',              en: 'Recommended' },
};

// ── Helper t(key, lang) ──
function t(key, lang) {
  var entry = DICT[key];
  if (!entry) return key;
  return entry[lang] || entry['vi'] || key;
}

// ── Build backward-compatible maps ──
function _buildLegacyMaps(dict) {
  var vi = {}, en = {};
  var viSeen = {}, enSeen = {};
  for (var key in dict) {
    var pair = dict[key];
    var v = pair.vi, e = pair.en;
    if (e !== undefined && v !== undefined) {
      if (viSeen[e] && viSeen[e] !== v) {
        console.warn('[translations.vi] Key conflict for "' + e + '": was "' + viSeen[e] + '", now "' + v + '" (from "' + key + '"). Use t() with semantic key.');
      }
      vi[e] = v; viSeen[e] = v;
    }
    if (v !== undefined && e !== undefined) {
      if (enSeen[v] && enSeen[v] !== e) {
        console.warn('[translations.en] Key conflict for "' + v + '": was "' + enSeen[v] + '", now "' + e + '" (from "' + key + '"). Use t() with semantic key.');
      }
      en[v] = e; enSeen[v] = e;
    }
  }
  return { vi: vi, en: en };
}

var translations = _buildLegacyMaps(DICT);

// ── Export — FIX: không dùng process (Node.js only) ──
if (typeof window !== 'undefined') {
  window.DICT         = DICT;
  window.t            = t;
  window.translations = translations;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DICT: DICT, t: t, translations: translations };
}