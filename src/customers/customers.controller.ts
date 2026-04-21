import { Controller, Get, Param, Request } from '@nestjs/common';
import { CustomersService } from './customers.service';

@Controller('api/v1/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get(':id')
  async getCustomer360(@Param('id') id: string, @Request() req: any) {
    // Giả sử user role được lấy từ JWT/Auth guard, mặc định là marketer để an toàn
    const userRole = req.user?.role || 'marketer';
    const result = await this.customersService.getCustomer360(id, userRole);
    return { data: result };
  }
}
