import { enrollmentDestination } from '../../../src/native/enrollmentLink';
import { enrollmentIntent } from '../../../src/ui/nfc/CardEnrollment';
const id = '0123456789abcdef01234567';
it('accepts only the two fixed native workflows and a member ObjectId', () => {
  expect(enrollmentDestination(`makerspace://fob-enrollment?memberId=${id}&flow=admin`)).toBe(`/members/${id}?enroll=1`);
  expect(enrollmentDestination(`makerspace://fob-enrollment?memberId=${id}&flow=issuer`)).toContain(`enrollMember=${id}`);
  for (const url of ['https://evil.example/', `makerspace://evil?memberId=${id}&flow=admin`, 'makerspace://fob-enrollment?memberId=../x&flow=admin', `makerspace://fob-enrollment?memberId=${id}&flow=other`]) expect(enrollmentDestination(url)).toBeNull();
  expect(enrollmentIntent(id, 'admin')).toContain('package=org.manchestermakerspace.portal;end');
});
