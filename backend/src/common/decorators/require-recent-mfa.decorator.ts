import { SetMetadata } from '@nestjs/common';

export const RECENT_MFA_KEY = 'requireRecentMfa';
/** Sensitive action: the session's last MFA check must be within 15 minutes. */
export const RequireRecentMfa = () => SetMetadata(RECENT_MFA_KEY, true);
