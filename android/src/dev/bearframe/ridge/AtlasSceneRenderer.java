package dev.bearframe.ridge;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Map;

/**
 * Renderer for Bearframe Engine Kit's framework/scene.js command packets.
 * App-specific atlas loading and UI composition are intentionally outside this class.
 * This is independent of the Sounding Ridge prototype's existing renderer.
 */
public final class AtlasSceneRenderer {
    private final Paint pixelPaint = new Paint();

    public AtlasSceneRenderer() {
        pixelPaint.setAntiAlias(false);
        pixelPaint.setFilterBitmap(false);
        pixelPaint.setDither(false);
    }

    private static Rect rect(JSONObject obj) throws JSONException {
        int x = obj.getInt("x"), y = obj.getInt("y");
        int w = obj.getInt("w"), h = obj.getInt("h");
        if (w <= 0 || h <= 0) throw new IllegalArgumentException("Invalid sprite dimensions");
        return new Rect(x, y, x + w, y + h);
    }

    /**
     * Reject invalid/missing image references before drawing anything.
     * Callers should render into an off-screen target before presenting a frame.
     */
    public void draw(Canvas target, JSONObject frame, Map<String, Bitmap> atlases) throws JSONException {
        if (target == null || frame == null || atlases == null)
            throw new IllegalArgumentException("Canvas, frame and atlases required");
        final int width = frame.getInt("width"), height = frame.getInt("height");
        if (width < 1 || height < 1 || width > 4096 || height > 4096)
            throw new IllegalArgumentException("Invalid render target dimensions");
        JSONArray commands = frame.getJSONArray("commands");
        for (int i = 0; i < commands.length(); i++) {
            JSONObject cmd = commands.getJSONObject(i);
            String kind = cmd.getString("type");
            if ("sprite".equals(kind)) {
                String id = cmd.getString("imageId");
                Bitmap image = atlases.get(id);
                if (image == null || image.isRecycled())
                    throw new IllegalArgumentException("Missing/unavailable atlas: " + id);
                Rect src = rect(cmd.getJSONObject("source"));
                rect(cmd.getJSONObject("dest"));
                if (src.left < 0 || src.top < 0 || src.right > image.getWidth() ||
                    src.bottom > image.getHeight())
                    throw new IllegalArgumentException("Frame beyond atlas bounds: " + id);
            } else if ("clear".equals(kind)) {
                Color.parseColor(cmd.getString("color"));
            } else throw new IllegalArgumentException("Unsupported draw command: " + kind);
        }

        final int savePoint = target.save();
        try {
            target.clipRect(0, 0, width, height);
            for (int i = 0; i < commands.length(); i++) {
                JSONObject cmd = commands.getJSONObject(i);
                String kind = cmd.getString("type");
                if ("clear".equals(kind)) {
                    target.drawColor(Color.parseColor(cmd.getString("color")));
                } else {
                    Bitmap image = atlases.get(cmd.getString("imageId"));
                    Rect source = rect(cmd.getJSONObject("source"));
                    Rect dest = rect(cmd.getJSONObject("dest"));
                    target.drawBitmap(image, source, dest, pixelPaint);
                }
            }
        } finally {
            target.restoreToCount(savePoint);
        }
    }
}
