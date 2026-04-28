-- =============================================================
-- Stored procedure: usp_tessbuddy_create_list
-- Purpose: Creates a Tessitura list from Tess Buddy.
--          Accepts base64-encoded SQL to bypass WAF detection.
--          Called via REST API: POST /api/Custom/Execute
--
-- BEFORE RUNNING: Verify table/column names match your Tessitura
-- version. Run this query to check the list table structure:
--   SELECT TOP 1 * FROM INFORMATION_SCHEMA.COLUMNS
--   WHERE TABLE_NAME = 'TR_LIST' ORDER BY ORDINAL_POSITION
--
-- If your table is named differently (e.g. T_LIST), adjust below.
-- =============================================================

CREATE OR ALTER PROCEDURE dbo.usp_tessbuddy_create_list
    @description     NVARCHAR(30),
    @list_sql_b64    NVARCHAR(MAX),   -- base64-encoded SQL
    @category_id     INT = 31         -- "Tess Buddy" category
AS
BEGIN
    SET NOCOUNT ON;

    -- Decode base64 → raw SQL string
    DECLARE @list_sql NVARCHAR(MAX);
    SET @list_sql = CAST(
        CAST(N'' AS XML).value(
            'xs:base64Binary(sql:variable("@list_sql_b64"))',
            'VARBINARY(MAX)'
        ) AS NVARCHAR(MAX)
    );

    -- Get next list_no
    DECLARE @list_no INT;
    SELECT @list_no = ISNULL(MAX(list_no), 0) + 1 FROM T_LIST;

    -- -------------------------------------------------------
    -- INSERT into Tessitura's list table.
    -- ** VERIFY these column names against your schema **
    -- -------------------------------------------------------
    INSERT INTO T_LIST (
        list_no,
        list_desc,
        criteria,
        category,
        control_group,
        edit_flag,
        tms,
        inactive


    )
    VALUES (
        @list_no,
        @description,
        @list_sql,
        @category_id,
        -1,          -- no control group
        'Y',         -- manually typed SQL
        1,           -- TMS / WordFly indicator
        'N'          -- not inactive

    );

    -- Return the new list ID as a result set
    SELECT @list_no AS Id, @description AS Description;
END;
GO

-- =============================================================
-- Register the procedure in TR_LOCAL_PROCEDURE so Custom/Execute
-- can find it. Adjust the ID if it conflicts with an existing row.
-- =============================================================
-- First check what IDs exist:
--   SELECT * FROM TR_LOCAL_PROCEDURE ORDER BY id

GO
