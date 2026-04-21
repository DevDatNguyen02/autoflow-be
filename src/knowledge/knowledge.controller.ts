import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('documents')
  async getDocuments() {
    return this.knowledgeService.getDocuments();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // Giới hạn 10MB
          new FileTypeValidator({ fileType: '.(pdf|txt|docx)' }), // Nhận PDF, TXT hoặc DOCX
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.knowledgeService.uploadDocument(file);
  }
}
