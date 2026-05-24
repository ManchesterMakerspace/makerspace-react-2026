const RUN_ID = Date.now();

export interface TestMember {
  firstname: string;
  lastname:  string;
  email:     string;
  password:  string;
  phone:     string;
  address: {
    street:     string;
    city:       string;
    state:      string;
    postalCode: string;
  };
}

export const buildTestMember = (testName: string): TestMember => ({
  firstname: 'Test',
  lastname:  testName,
  email:     `e2e_${testName}_${RUN_ID}@test.com`,
  password:  'password',
  phone:     '5551212',
  address: {
    street:     '12 Main St.',
    city:       'Boston',
    state:      'MA',
    postalCode: '00001',
  },
});

export interface CreditCard {
  number:     string;
  expiration: string;
  csv:        string;
  postalCode: string;
  name:       string;
}

// Expiration format is MMYY (no slash) as confirmed by codegen
export const newVisa: CreditCard = {
  number:     '4111111111111111',
  expiration: '1226',
  csv:        '123',
  postalCode: '10036',
  name:       'Test Member',
};

export const newMastercard: CreditCard = {
  number:     '5555555555554444',
  expiration: '1226',
  csv:        '123',
  postalCode: '10036',
  name:       'Test Member',
};

export const basicMember   = { email: 'basic_member0@test.com',   password: 'password' };
export const adminMember   = { email: 'admin_member0@test.com',   password: 'password' };
export const paypalMember  = { email: 'paypal_member0@test.com',  password: 'password' };
export const expiredMember = { email: 'expired_member0@test.com', password: 'password' };
