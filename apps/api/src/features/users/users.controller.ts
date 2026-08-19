import { Request, Response } from 'express';
import { usersService } from './users.service';
import { asyncHandler } from '../../core/middleware/errorHandler';

/**
 * Users Controller
 * Handles HTTP requests for user management
 */
export class UsersController {
    /**
     * GET /users
     */
    getAll = asyncHandler(async (_req: Request, res: Response) => {
        const users = await usersService.getAll();

        res.status(200).json({
            success: true,
            data: users,
        });
    });

    /**
     * GET /users/:id
     */
    getById = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const user = await usersService.getById(id);

        res.status(200).json({
            success: true,
            data: user,
        });
    });

    /**
     * PATCH /users/:id
     */
    update = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const user = await usersService.update(id, req.body);

        res.status(200).json({
            success: true,
            data: user,
        });
    });

    /**
     * DELETE /users/:id
     */
    delete = asyncHandler(async (req: Request, res: Response) => {
        const id = req.params.id as string;
        await usersService.delete(id);

        res.status(200).json({
            success: true,
            message: 'Usuario eliminado correctamente',
        });
    });
}

// Export singleton instance
export const usersController = new UsersController();
