import { Global, Module } from '@nestjs/common';
import { PermissionResolverService } from './permission-resolver.service';
import { DeveloperAccessService } from './developer-access.service';
import { DeveloperAccessController } from './developer-access.controller';
import { ScopeService } from './scope.service';

@Global()
@Module({
  controllers: [DeveloperAccessController],
  providers: [PermissionResolverService, DeveloperAccessService, ScopeService],
  exports: [PermissionResolverService, ScopeService],
})
export class RbacModule {}
