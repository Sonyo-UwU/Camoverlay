export default class Template {
    name: string;
    bitmap: ImageBitmap;


    constructor(name: string, bitmap: ImageBitmap) {
        this.name = name;
        this.bitmap = bitmap;
    }

    drawOnTile(ctx: OffscreenCanvasRenderingContext2D) {
        ctx.drawImage(this.bitmap, 0, 0);
    }
}
