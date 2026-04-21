<Button onClick={handleClick}>提交</Button>
<Input value={name} onChange={handleChange} />
<Select>
  <SelectTrigger>
    <SelectValue placeholder="选择角色" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="admin">管理员</SelectItem>
    <SelectItem value="user">普通用户</SelectItem>
  </SelectContent>
</Select>
