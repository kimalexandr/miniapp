import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProfileDto } from './dto/client-profile.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateClient(userId: string) {
    let client = await this.prisma.client.findUnique({ where: { userId } });
    if (!client) {
      client = await this.prisma.client.create({
        data: { userId },
      });
    }
    return client;
  }

  async updateProfile(userId: string, dto: ClientProfileDto) {
    const client = await this.getOrCreateClient(userId);
    return this.prisma.client.update({
      where: { id: client.id },
      data: {
        companyName: dto.companyName,
        companyType: dto.companyType,
        inn: dto.inn,
        kpp: dto.kpp,
        legalAddress: dto.legalAddress,
        email: dto.email,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        preferredPaymentType: dto.preferredPaymentType,
      },
    });
  }

  async getProfile(userId: string) {
    return this.getOrCreateClient(userId);
  }
}
