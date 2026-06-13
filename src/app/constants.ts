export namespace Routing {
  export enum PathPlaceholder {
    Optional = '?',
    MemberId = ':memberId',
    Resource = ':resource',
    ResourceId = ':resourceId',
    InvoiceId = ':invoiceId',
    Email = ':email',
    SpotId = ':spotId',
  }

  export const Root = '/';
  export const Login = '/login';
  export const SignUp = '/signup';
  export const Members = '/members';
  export const Documents = `/agreements/${Routing.PathPlaceholder.Resource}/${Routing.PathPlaceholder.ResourceId}${Routing.PathPlaceholder.Optional}`;
  export const Profile = `${Members}/${PathPlaceholder.MemberId}`;
  export const CheckInActivity = `${Profile}/checkin-activity`;

  export const Billing = '/billing';
  export const Subscriptions = '/subscriptions';
  export const Rentals = '/rentals';
  export const AdminRentals = '/admin/rentals';
  export const RentalSpotDeepLink = `${Rentals}/spots/${PathPlaceholder.SpotId}`;
  export const ShopFees = '/shop-fees';
  export const ToolCheckouts = '/tool-checkouts';
  export const Analytics = '/admin/analytics';
  export const Volunteer = '/volunteer';
  export const SystemSettings = '/admin/system-settings';
  export const AuditLog = '/admin/audit-log';
  export const Checkout = '/checkout';
  export const Receipt = `${Checkout}/receipt/${PathPlaceholder.InvoiceId}`;
  export const PasswordReset = '/resetPassword';
  export const Settings = `${Profile}/settings`;
  export const SendRegistration = `/send-registration/${PathPlaceholder.Email}`;
  export const EarnedMemberships = '/earned-memberships';
  export const Unsubscribe = `/unsubscribe/${PathPlaceholder.MemberId}`;
}

export enum CrudOperation {
  Read = 'read',
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

export enum Whitelists {
  billing = 'billing',
  customBilling = 'custom_billing',
  earnedMembership = 'earned_membership',
}
