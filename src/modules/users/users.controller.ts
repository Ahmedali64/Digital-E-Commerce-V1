import { Controller, Get, HttpStatus, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from 'src/common/types/authenticated-request.type';

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile (requires JWT)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Invalid or missing token',
  })
  getProfile(@Req() req: AuthenticatedRequest) {
    // req.user comes from JwtStrategy.validate()
    return {
      message: 'Profile retrieved successfully',
      user: req.user,
    };
  }
}
