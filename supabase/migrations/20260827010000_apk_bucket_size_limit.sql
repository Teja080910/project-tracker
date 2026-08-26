-- Allow large APK uploads in the apks bucket (250 MB)
UPDATE storage.buckets SET file_size_limit = 262144000 WHERE id = 'apks';
