import assert from 'assert';

async function runTests() {
  const origin = 'http://localhost:5000';
  console.log('Starting multi-product integration tests against:', origin);

  // 1. Get initial system status (should list all products)
  console.log('\n--- Test 1: Fetch System Status & Catalog ---');
  const statusRes = await fetch(`${origin}/api/settings/book-status`);
  const statusData = await statusRes.json();
  console.log('System Status Order Open:', statusData.orderOpen);
  console.log('Catalog products loaded:', statusData.products.map(p => p.id));
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(statusData.products.length, 5); // 5 products total

  // 2. Submit order for openai product
  console.log('\n--- Test 2: Submit Order for OpenAI Product ---');
  const formData1 = new FormData();
  formData1.append('name', 'AI Explorer');
  formData1.append('phone', '555-0099');
  formData1.append('email', 'ai@example.com');
  formData1.append('productId', 'openai'); // specific product!
  formData1.append('note', 'Purchasing OpenAI API Guide.');
  
  const mockImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const mockFile = new File([mockImageBuffer], 'receipt1.png', { type: 'image/png' });
  formData1.append('paymentProof', mockFile);

  const orderRes = await fetch(`${origin}/api/orders`, {
    method: 'POST',
    body: formData1
  });
  const orderData = await orderRes.json();
  console.log('Order submission response:', orderData);
  assert.strictEqual(orderRes.status, 201);
  assert.ok(orderData.receiptCode);
  
  const receiptCode = orderData.receiptCode;

  // 3. Admin login
  console.log('\n--- Test 3: Admin Login ---');
  const loginRes = await fetch(`${origin}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'supersecretpassword'
    })
  });
  const loginData = await loginRes.json();
  console.log('Admin login token received');
  assert.strictEqual(loginRes.status, 200);
  const adminToken = loginData.token;

  // 4. Admin get orders & verify order is for OpenAI
  console.log('\n--- Test 4: Verify Order Details via Admin Dashboard ---');
  const ordersRes = await fetch(`${origin}/api/admin/orders`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const ordersData = await ordersRes.json();
  const foundOrder = ordersData.orders.find(o => o.receiptCode === receiptCode);
  assert.ok(foundOrder);
  assert.strictEqual(foundOrder.productId, 'openai');
  console.log('Verified order is mapped to product:', foundOrder.product.name);

  const verifyRes = await fetch(`${origin}/api/admin/orders/${foundOrder.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'verified' })
  });
  assert.strictEqual(verifyRes.status, 200);
  console.log('Order approved successfully.');

  // 5. Update Product settings specifically
  console.log('\n--- Test 5: Configure OpenAI PDF/EPUB Locators ---');
  const prodRes = await fetch(`${origin}/api/admin/products/openai`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      pdfLocator: 'sample.pdf',
      epubLocator: 'sample.epub',
      pdfFilename: 'OpenAI_API_Handbook.pdf',
      epubFilename: 'OpenAI_API_Handbook.epub'
    })
  });
  const prodData = await prodRes.json();
  console.log('Update product configuration response PDF Locator:', prodData.pdfLocator);
  assert.strictEqual(prodRes.status, 200);
  assert.strictEqual(prodData.pdfLocator, 'sample.pdf');

  // 6. Download PDF Book specific to OpenAI product
  console.log('\n--- Test 6: Download OpenAI Book File ---');
  const dlRes = await fetch(`${origin}/api/orders/${receiptCode}/download/pdf`);
  console.log('Download PDF response status:', dlRes.status);
  assert.strictEqual(dlRes.status, 200);
  const content = await dlRes.text();
  console.log('Downloaded File Header matches PDF spec:', content.slice(0, 10));
  assert.ok(content.includes('PDF'));

  // 7. Verify stats increment
  console.log('\n--- Test 7: Verify Download Counter ---');
  const finalOrdersRes = await fetch(`${origin}/api/admin/orders`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const finalOrdersData = await finalOrdersRes.json();
  const updatedOrder = finalOrdersData.orders.find(o => o.receiptCode === receiptCode);
  console.log('OpenAI PDF Download Count:', updatedOrder.downloadCountPdf);
  assert.strictEqual(updatedOrder.downloadCountPdf, 1);

  console.log('\n🎉 ALL MULTI-PRODUCT TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
